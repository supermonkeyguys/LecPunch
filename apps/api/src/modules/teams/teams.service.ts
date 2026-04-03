import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema';

@Injectable()
export class TeamsService {
  constructor(@InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>) {}

  findById(id: string) {
    return this.teamModel.findById(id).exec();
  }

  async ensureDefaultTeam(name: string) {
    let team = await this.teamModel.findOne({ name }).exec();
    if (!team) {
      team = await this.teamModel.create({ name, status: 'active' });
    }
    return team;
  }
}
