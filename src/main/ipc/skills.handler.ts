import { ipcMain, dialog } from 'electron';
import type { SkillsService } from '../services/SkillsService';

export function registerSkillsHandlers(skillsService: SkillsService): void {
  ipcMain.handle('skills:get-sources', () => {
    return skillsService.getSources();
  });

  ipcMain.handle('skills:list', async (_event, sourceId: string) => {
    return skillsService.listSkills(sourceId);
  });

  ipcMain.handle('skills:get-detail', async (_event, sourceId: string, skillPath: string) => {
    return skillsService.getSkillDetail(sourceId, skillPath);
  });

  ipcMain.handle(
    'skills:install',
    async (_event, sourceId: string, skillPath: string, targetDir: string) => {
      return skillsService.installSkill(sourceId, skillPath, targetDir);
    },
  );

  ipcMain.handle('skills:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('skills:search-directory', async (_event, query: string, limit?: number) => {
    return skillsService.searchDirectory(query, limit);
  });

  ipcMain.handle('skills:directory-detail', async (_event, source: string, skillId: string) => {
    return skillsService.getDirectorySkillDetail(source, skillId);
  });

  ipcMain.handle(
    'skills:directory-install',
    async (_event, source: string, skillId: string, targetDir: string) => {
      return skillsService.installDirectorySkill(source, skillId, targetDir);
    },
  );
}
