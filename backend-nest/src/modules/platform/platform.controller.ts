import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

class ListOrgsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @IsString() status?: string;
}

class ListUsersQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() org_id?: string;
}
import { Response } from 'express';
import { PlatformService } from './platform.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { SuperAdminAuthGuard } from '../../common/guards/superadmin-auth.guard';
import { AppError } from '../../common/errors/app.error';

// ── Superadmin Controller ─────────────────────────────────────────────────────

@Controller('api/superadmin')
@UseGuards(SuperAdminAuthGuard)
export class SuperadminController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('dashboard')
  async getDashboard(@Res() res: Response) {
    const data = await this.platformService.getDashboard();
    return res.status(200).json({ success: true, data });
  }

  @Get('organizations')
  async listOrgs(@Query() query: ListOrgsQueryDto, @Res() res: Response) {
    const orgs = await this.platformService.listOrgs(query);
    return res.status(200).json({ success: true, data: orgs });
  }

  @Post('organizations')
  async createOrg(@Body() body: CreateOrgDto, @Res() res: Response) {
    const result = await this.platformService.createOrg(body);
    return res.status(201).json({ success: true, message: 'Organization created', data: result });
  }

  @Get('organizations/:id')
  async getOrgDetail(@Param('id') id: string, @Res() res: Response) {
    if (!id) throw AppError.badRequest('Organization ID is required');
    const org = await this.platformService.getOrgDetail(id);
    return res.status(200).json({ success: true, data: org });
  }

  @Put('organizations/:id')
  async updateOrg(@Param('id') id: string, @Body() body: UpdateOrgDto, @Res() res: Response) {
    if (!id) throw AppError.badRequest('Organization ID is required');
    const org = await this.platformService.updateOrg(id, body);
    return res.status(200).json({ success: true, message: 'Organization updated', data: org });
  }

  @Delete('organizations/:id')
  async deleteOrg(@Param('id') id: string, @Res() res: Response) {
    if (!id) throw AppError.badRequest('Organization ID is required');
    await this.platformService.deleteOrg(id);
    return res.status(200).json({ success: true, message: 'Organization deleted', data: null });
  }

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto, @Res() res: Response) {
    const users = await this.platformService.listUsers(query);
    return res.status(200).json({ success: true, data: users });
  }
}

// ── Plans Controller ──────────────────────────────────────────────────────────

@Controller('plans')
export class PlansController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  findAll() {
    return this.platformService.listPlans();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.platformService.getPlanById(id);
  }

  @Post()
  @UseGuards(SuperAdminAuthGuard)
  create(@Body() dto: CreatePlanDto) {
    return this.platformService.createPlan(dto);
  }

  @Put(':id')
  @UseGuards(SuperAdminAuthGuard)
  update(@Param('id') id: string, @Body() dto: Partial<CreatePlanDto>) {
    return this.platformService.updatePlan(id, dto);
  }
}
