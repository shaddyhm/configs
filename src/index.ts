import { path as rootPath } from 'app-root-path';
import * as fs from 'fs';
import * as Mustache from 'mustache';
import * as path from 'path';
import * as util from 'util';
import * as YAML from 'yaml';

import { DirectoryError } from './errors/directory.error';
import { FileError } from './errors/file.error';
import { ParserError } from './errors/parser.error';

const readFileAsync = util.promisify(fs.readFile);

export type ConfigsOptions = {
  fetchData: () => Promise<{ [key: string]: any }>;
  pathDelimiter: string;
  configsDirectory: string;
  // in milliseconds
  cacheExpiryTime: number;
  configsResolver: (env: string) => string[];
};

export class Configs {
  private static defaultOptions: ConfigsOptions = {
    fetchData: () => Promise.resolve({}),
    pathDelimiter: '.',
    configsDirectory: 'configs',
    cacheExpiryTime: 60 * 1000,
    configsResolver: (env: string) => [`config.${env}.yaml`],
  };

  private value!: { [key: string]: any };

  private valueSetTime: number = 0;

  private constructor(private readonly options: ConfigsOptions) {}

  public static create = (
    fn: (opt: ConfigsOptions) => void = () => {},
  ): Configs => {
    const opt = { ...Configs.defaultOptions };
    fn(opt);

    // apply default options if options not provided
    if (!opt.fetchData) opt.fetchData = Configs.defaultOptions.fetchData;
    if (!opt.pathDelimiter)
      opt.pathDelimiter = Configs.defaultOptions.pathDelimiter;
    if (!opt.configsDirectory)
      opt.configsDirectory = Configs.defaultOptions.configsDirectory;
    if (!opt.cacheExpiryTime)
      opt.cacheExpiryTime = Configs.defaultOptions.cacheExpiryTime;
    if (!opt.configsResolver)
      opt.configsResolver = Configs.defaultOptions.configsResolver;

    // validate directory
    const directoryExists = fs.existsSync(
      path.join(rootPath, opt.configsDirectory),
    );
    if (!directoryExists)
      throw new DirectoryError(
        `Directory ${opt.configsDirectory} does not exist`,
      );

    // validate resolver and extensions
    const resolvedFiles = opt.configsResolver(
      process.env.NODE_ENV || 'development',
    );
    resolvedFiles.forEach((file) => {
      // validate file
      const configFileExists = fs.existsSync(
        path.join(rootPath, opt.configsDirectory, file),
      );
      if (!configFileExists)
        throw new FileError(`Config file ${file} does not exist`);

      // validate extension
      const ext = path.extname(file);
      const isExtensionSupported = ['.yaml', '.yml'].includes(ext);
      if (!isExtensionSupported)
        throw new ParserError(
          `Unsupported file extension ${ext}. Only .yaml and .yml are supported.`,
        );
    });

    return new Configs(opt);
  };

  public get = async <T>(key: string = ''): Promise<T> => {
    const now = Date.now();
    const expiryTime = this.valueSetTime + this.options.cacheExpiryTime;
    if (!this.value || now > expiryTime) {
      const data = await this.options.fetchData();
      this.valueSetTime = now;
      this.value = await this.options
        .configsResolver(process.env.NODE_ENV || 'development')
        .reduce(async (valuePromise, file) => {
          const value = await valuePromise;
          const filePath = path.join(
            rootPath,
            this.options.configsDirectory,
            file,
          );
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
        }, Promise.resolve({}));
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
