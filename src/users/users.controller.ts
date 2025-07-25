import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { RolesGuard } from 'src/auth/roles/roles.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access_token')
export class UsersController {
    constructor(private usersService: UsersService) {}
    
    @Get('profile')
    getProfile(@Request() req){
        return this.usersService.user({ email: req.user.email })
    }
}
