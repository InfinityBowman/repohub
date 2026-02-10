import { registerRepositoryHandlers } from './repository.handler'
import { registerProcessHandlers } from './process.handler'
import { registerPortHandlers } from './port.handler'
import { registerConfigHandlers } from './config.handler'
import { registerHealthHandlers } from './health.handler'
import { registerGitHubHandlers } from './github.handler'
import { registerGitHandlers } from './git.handler'
import { registerScaffoldHandlers } from './scaffold.handler'
import type { RepositoryService } from '../services/RepositoryService'
import type { ProcessService } from '../services/ProcessService'
import type { PortService } from '../services/PortService'
import type { ConfigService } from '../services/ConfigService'
import type { DependencyHealthService } from '../services/DependencyHealthService'
import type { GitHubService } from '../services/GitHubService'
import type { GitBranchService } from '../services/GitBranchService'
import type { ScaffoldService } from '../services/ScaffoldService'

export function registerAllHandlers(services: {
  repositoryService: RepositoryService
  processService: ProcessService
  portService: PortService
  configService: ConfigService
  healthService: DependencyHealthService
  githubService: GitHubService
  gitBranchService: GitBranchService
  scaffoldService: ScaffoldService
}): void {
  registerRepositoryHandlers(services.repositoryService)
  registerProcessHandlers(services.processService)
  registerPortHandlers(services.portService)
  registerConfigHandlers(services.configService)
  registerHealthHandlers(services.healthService)
  registerGitHubHandlers(services.githubService)
  registerGitHandlers(services.repositoryService, services.gitBranchService)
  registerScaffoldHandlers(services.scaffoldService)
}
