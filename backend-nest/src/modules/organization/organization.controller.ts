import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgAdminGuard } from '../../common/guards/org-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HttpMessage } from '../../common/decorators/message.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AppError } from '../../common/errors/app.error';
import { UpdateOrgDto } from './dto/update-org.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

// ── Organizations Controller ──────────────────────────────────────────────────

@Controller('api/organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('me')
  getOrg(@CurrentUser() user: AuthenticatedUser) {
    if (!user.orgId) throw AppError.notFound('Organization');
    return this.organizationService.getOrg(user.orgId);
  }

  @Put('me')
  @UseGuards(OrgAdminGuard)
  @HttpMessage('Organization updated')
  updateOrg(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOrgDto) {
    return this.organizationService.updateOrg(user.userId, user.orgId, dto);
  }

  @Get('me/team')
  getTeam(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.getTeam(user.orgId);
  }

  @Post('me/members')
  @UseGuards(OrgAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @HttpMessage('Member created')
  createMember(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMemberDto) {
    return this.organizationService.createMember(user.userId, user.orgId, dto);
  }

  @Delete('me/members/:memberId')
  @UseGuards(OrgAdminGuard)
  @HttpMessage('Member removed')
  removeMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.removeMember(user.userId, user.orgId, memberId);
  }

  @Put('me/plan')
  @UseGuards(OrgAdminGuard)
  @HttpMessage('Plan updated')
  changePlan(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePlanDto) {
    return this.organizationService.changePlan(user.userId, user.orgId, dto.plan);
  }
}

// ── Roles Controller ──────────────────────────────────────────────────────────

@Controller('api/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.listRoles(user.orgId);
  }

  @Post()
  @UseGuards(OrgAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @HttpMessage('Role created')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    if (!user.orgId) throw AppError.forbidden('Organization context required');
    return this.organizationService.createRole(user.orgId, dto);
  }

  @Put(':id')
  @UseGuards(OrgAdminGuard)
  @HttpMessage('Role updated')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.organizationService.updateRole(id, user.orgId, dto);
  }

  @Delete(':id')
  @UseGuards(OrgAdminGuard)
  @HttpMessage('Role deleted')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.removeRole(id, user.orgId);
  }

  @Post('assign')
  @UseGuards(OrgAdminGuard)
  @HttpMessage('Role assigned')
  assign(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssignRoleDto) {
    return this.organizationService.assignRole(user.orgId, dto);
  }
}
