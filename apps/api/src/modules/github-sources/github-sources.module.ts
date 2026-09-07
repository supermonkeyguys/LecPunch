import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GitHubSourcesController } from './github-sources.controller';
import { GitHubSourcesTeamController } from './github-sources-team.controller';
import { GitHubSourcesService } from './github-sources.service';
import { GitHubSource, GitHubSourceSchema } from './schemas/github-source.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: GitHubSource.name, schema: GitHubSourceSchema }])
  ],
  providers: [GitHubSourcesService],
  controllers: [GitHubSourcesController, GitHubSourcesTeamController],
  exports: [GitHubSourcesService]
})
export class GitHubSourcesModule {}
