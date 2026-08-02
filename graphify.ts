import type { ModApi } from '@commandcode/harness';
import modFactory from './index';

/**
 * Re-export of main index factory for single-file mod compatibility (`cmd --mod ./graphify.ts`).
 */
export default function (cmd: ModApi) {
  return modFactory(cmd);
}
