import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    register(@Body() body: RegisterDto){
        return this.authService.register(body)
    }

    @ApiOperation({ summary: 'Login user and return access token' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @Public()
    @Post('login')
    login(@Body() body: LoginDto) {
        return this.authService.login(body.email, body.password)
    }

}
