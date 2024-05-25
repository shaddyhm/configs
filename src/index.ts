import { path as rootPath } from 'app-root-path';
import * as fs from 'fs';
import * as Mustache from 'mustache';
import * as path from 'path';
import * as util from 'util';
import * as YAML from 'yaml';

import { ExtensionError, FilesError, ResolverError } from './errors';
import { DirectoryError } from './errors/directory.error';
import { FileError } from './errors/file.error';

const readFileAsync = util.promisify(fs.readFile);

export type ConfigsResolver = {
  directory: string;
  env: string;
  fetchData?: () => Promise<{ [key: string]: any }>;
  files: string[];
};

export type ConfigsOptions = {
  // in milliseconds
  cacheExpiryTime: number;
  pathDelimiter: string;
  resolvers: ConfigsResolver[];
};

export interface IConfigs {
  get: <T>(key?: string) => Promise<T>;
}

export class Configs implements IConfigs {
  private static defaultOptions: ConfigsOptions = {
    cacheExpiryTime: 60 * 1000,
    pathDelimiter: '.',
    resolvers: [],
  };

  private resolver!: ConfigsResolver;

  private value!: { [key: string]: any };

  private valueSetTime: number = 0;

  private constructor(private readonly options: ConfigsOptions) {}

  public static create = (
    fn: (opt: ConfigsOptions) => void = () => {},
  ): Configs => {
    const opt = { ...Configs.defaultOptions };
    fn(opt);

    // apply default options if options not provided
    if (!opt.cacheExpiryTime)
      opt.cacheExpiryTime = Configs.defaultOptions.cacheExpiryTime;
    if (!opt.pathDelimiter)
      opt.pathDelimiter = Configs.defaultOptions.pathDelimiter;
    if (!opt.resolvers) opt.resolvers = Configs.defaultOptions.resolvers;

    const resolver = opt.resolvers.find(
      (resolver) => resolver.env === (process.env.NODE_ENV || 'development'),
    );
    if (!resolver) throw new ResolverError('Resolver not found');

    // validate directory
    const directoryExists = fs.existsSync(
      path.join(rootPath, resolver.directory),
    );
    if (!directoryExists)
      throw new DirectoryError(
        `Directory ${resolver.directory} does not exist`,
      );

    if (!resolver.files || !resolver.files.length)
      throw new FilesError(`No config files provided for ${resolver.env} env`);

    // validate resolver files and extensions
    resolver.files.forEach((file) => {
      // validate file existence
      const configFileExists = fs.existsSync(
        path.join(rootPath, resolver.directory, file),
      );
      if (!configFileExists)
        throw new FileError(`Config file ${file} does not exist`);

      // validate yml extension
      const ext = path.extname(file);
      const isExtensionSupported = ['.yaml', '.yml'].includes(ext);
      if (!isExtensionSupported)
        throw new ExtensionError(
          `Unsupported file extension ${ext}. Only .yaml and .yml are supported.`,
        );
    });

    const configs = new Configs(opt);
    configs.resolver = resolver;
    return configs;
  };

  public get = async <T>(key: string = ''): Promise<T> => {
    const now = Date.now();
    const expiryTime = this.valueSetTime + this.options.cacheExpiryTime;
    if (!this.value || now > expiryTime) {
      const data = this.resolver.fetchData
        ? await this.resolver.fetchData()
        : {};
      this.valueSetTime = now;
      this.value = await this.resolver.files.reduce(
        async (valuePromise, file) => {
          const value = await valuePromise;
          const filePath = path.join(rootPath, this.resolver.directory, file);
          let content = await readFileAsync(filePath, { encoding: 'utf-8' });
          content = Mustache.render(
            content,
            data,
            {},
            {
              escape: (text) => text,
              tags: ['${{', '}}'],
            },
          );
          return { ...value, ...YAML.parse(content) };
        },
        Promise.resolve({}),
      );
    }

    if (!key) return this.value as T;

    return key.split(this.options.pathDelimiter).reduce((value, key) => {
      const type = Object.prototype.toString.call(value).slice(8, -1);
      switch (type) {
        case 'Object':
          return value[key];
        case 'Array':
          const index = Number.isInteger(parseInt(key)) ? parseInt(key) : -1;
          return value[index];
        default:
          return value;
      }
    }, this.value) as T;
  };
}
