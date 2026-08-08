import { describe, expect, it } from 'vitest';
import { dirnameSystemPath, joinSystemPath } from '../src/platform/systemPath';

describe('system paths', () => {
  it('joins and resolves parent directories on Unix paths', () => {
    expect(joinSystemPath('/vault/.obsidian/plugins/cimu-print', '.temp'))
      .toBe('/vault/.obsidian/plugins/cimu-print/.temp');
    expect(dirnameSystemPath('/vault/.obsidian/plugins/cimu-print/cimu-print-cli.json'))
      .toBe('/vault/.obsidian/plugins/cimu-print');
  });

  it('joins and resolves parent directories on Windows paths', () => {
    expect(joinSystemPath('C:\\Vault\\.obsidian\\plugins\\cimu-print', '.temp/output'))
      .toBe('C:\\Vault\\.obsidian\\plugins\\cimu-print\\.temp\\output');
    expect(dirnameSystemPath('C:\\Vault\\.obsidian\\plugins\\cimu-print\\cimu-print-cli.json'))
      .toBe('C:\\Vault\\.obsidian\\plugins\\cimu-print');
  });
});
