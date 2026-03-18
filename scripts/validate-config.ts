import { loadPlatformConfig, maskConfig } from '../packages/config/src/index';

try {
  const config = loadPlatformConfig();
  console.log('Config validation: OK');
  console.log(JSON.stringify(maskConfig(config), null, 2));
} catch (error) {
  console.error('Config validation failed');
  console.error(error);
  process.exitCode = 1;
}
