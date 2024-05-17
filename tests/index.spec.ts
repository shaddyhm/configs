import * as assert from 'assert';

import { Configs } from '../src/';
import { DirectoryError, FileError, ParserError } from '../src/errors';

describe('Test empty options', () => {
  let config: Configs;

  beforeEach(() => {
    config = Configs.create((opt) => {
      opt.fetchData = null as any;
      opt.pathDelimiter = null as any;
      opt.configsDirectory = '/tests/configs';
      opt.cacheExpiryTime = null as any;
      opt.configsResolver = () => ['config.development.yaml'];
    });
  });

  it('should return the entire value if the key is not provided', async () => {
    const value = await config.get();
    assert.deepStrictEqual(value, {
      description: 'someotherdescription',
      version: null,
      prop5: [null, null],
    });
  });
});

describe('Test unhappy paths', () => {
  it('should throw an error if the directory does not exist', () => {
    assert.throws(() => {
      Configs.create((opt) => {
        opt.configsDirectory = '/tests/configsss';
      });
    }, new DirectoryError('Directory /tests/configsss does not exist'));
  });

  it('should throw an error if the config file does not exist', () => {
    assert.throws(() => {
      Configs.create((opt) => {
        opt.configsDirectory = '/tests/configs';
        opt.configsResolver = () => ['config.development.json'];
      });
    }, new FileError('Config file config.development.json does not exist'));
  });

  it('should throw an error if the parser is not supported', () => {
    assert.throws(() => {
      Configs.create((opt) => {
        opt.configsDirectory = '/tests/configs';
        opt.configsResolver = () => ['config.invalid.json'];
      });
    }, new ParserError('Unsupported file extension .json. Only .yaml and .yml are supported.'));
  });
});

describe('Test happy paths', () => {
  let config: Configs;

  beforeEach(() => {
    config = Configs.create((opt) => {
      opt.configsDirectory = '/tests/configs';
      opt.configsResolver = (env: string) => [
        'common.yaml',
        `config.${env}.yaml`,
      ];
      opt.pathDelimiter = '/';
      opt.fetchData = () =>
        Promise.resolve({
          version: 'v1.2.3',
          someobject: {
            prop4: 'value4',
          },
          somelist: ['value5', 'value6'],
          author: {
            name: 'Shaddy Mansour',
          },
        });
    });
  });

  it('should return the entire value if the key is not provided', async () => {
    const value = await config.get();
    assert.deepStrictEqual(value, {
      name: 'somename',
      description: 'someotherdescription',
      version: 'v1.2.3',
      prop1: {
        prop2: {
          prop3: 'value3',
          prop4: 'value4',
        },
      },
      prop5: ['value5', 'value6'],
      object: { name: 'Shaddy Mansour' },
    });
  });

  it("should return properties from the 'common' config without overwriting them", async () => {
    const value = await config.get('name');
    assert.equal('somename', value);
  });

  it("should return overridden properties from the 'development' config", async () => {
    const value = await config.get('description');
    assert.equal('someotherdescription', value);
  });

  it('should return interpolated properties', async () => {
    const value = await config.get('version');
    assert.equal('v1.2.3', value);
  });

  it('should return nested properties', async () => {
    const value = await config.get('prop1/prop2/prop3');
    assert.equal('value3', value);
  });

  it('should return interpolated nested properties', async () => {
    const value = await config.get('prop1/prop2/prop4');
    assert.equal('value4', value);
  });

  it('should return interpolated properties list', async () => {
    const value = await config.get('prop5');
    assert.deepEqual(value, ['value5', 'value6']);
  });

  it('should return interpolated list item', async () => {
    const value = await config.get('prop5/0');
    assert.equal('value5', value);
  });

  it('should return the object', async () => {
    const value = await config.get('object');
    assert.deepEqual(value, { name: 'Shaddy Mansour' });
  });
});
