import type { ModApi } from '@commandcode/harness';
import { GraphifyCliService } from './src/cli';
import { registerGraphifyRenderer } from './src/renderer';
import { registerSlashCommands } from './src/commands';
import { registerAiTools } from './src/tools';
import { registerLifecycleHooks } from './src/hooks';

/**
 * CommandCode Mod: cmd-mod-graphify
 * Full integration of Graphify Knowledge Graph (https://github.com/Graphify-Labs/graphify)
 */
export default function (cmd: ModApi) {
  // Register Mod Flags
  cmd.addFlag('auto-build', {
    type: 'boolean',
    default: false,
    description: 'Automatically build Graphify index on session start if missing',
  });

  // Initialize Services & Modules
  const cliService = new GraphifyCliService(cmd);

  registerGraphifyRenderer(cmd);
  registerSlashCommands(cmd, cliService);
  registerAiTools(cmd, cliService);
  registerLifecycleHooks(cmd, cliService);
}
