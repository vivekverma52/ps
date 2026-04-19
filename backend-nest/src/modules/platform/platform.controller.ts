import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { ListOrgsQueryDto } from './dto/list-orgs-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SuperAdminAuthGuard } from '../../common/guards/superadmin-auth.guard';
import { HttpMessage } from '../../common/decorators/message.decorator';

// ── Superadmin Controller ─────────────────────────────────────────────────────

@Controller('api/superadmin')
@UseGuards(SuperAdminAuthGuard)
export class SuperadminController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('dashboard')
  getDashboard() {
    return this.platformService.getDashboard();
  }

  @Get('organizations')
  listOrgs(@Query() query: ListOrgsQueryDto) {
    return this.platformService.listOrgs(query);
  }

  @Post('organizations')
  @HttpCode(201)
  @HttpMessage('Organization created')
  createOrg(@Body() body: CreateOrgDto) {
    return this.platformService.createOrg(body);
  }

  @Get('organizations/:id')
  getOrgDetail(@Param('id') id: string) {
    return this.platformService.getOrgDetail(id);
  }

  @Put('organizations/:id')
  @HttpMessage('Organization updated')
  updateOrg(@Param('id') id: string, @Body() body: UpdateOrgDto) {
    return this.platformService.updateOrg(id, body);
  }

  @Delete('organizations/:id')
  @HttpMessage('Organization deleted')
  deleteOrg(@Param('id') id: string) {
    return this.platformService.deleteOrg(id);
  }

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.platformService.listUsers(query);
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
