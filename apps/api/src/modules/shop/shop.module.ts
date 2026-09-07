import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PointsModule } from '../points/points.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { SkinUnlock, SkinUnlockSchema } from './schemas/skin-unlock.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SkinUnlock.name, schema: SkinUnlockSchema }
    ]),
    PointsModule
  ],
  controllers: [ShopController],
  providers: [ShopService]
})
export class ShopModule {}
