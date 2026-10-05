import { Controller } from '@nestjs/common';
import { UserService } from './user.service';
import { Body, Get, Param, Post, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { type UserDto, type NewUserDto, UserSchema, NewUserSchema } from './dto/user.dto';

@Controller('user')
@ApiTags('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ standardSchema: UserSchema })
  async createUser(
    @Body({ schema: NewUserSchema }) data: NewUserDto,
  ): Promise<UserDto> {
    return this.userService.createUser(data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiCreatedResponse({ standardSchema: UserSchema })
  async getUserById(@Param('id') id: string): Promise<UserDto | null> {
    return this.userService.getUserById(id);
  }

  @Get('email/:email')
  @ApiOperation({ summary: 'Get a user by email' })
  @ApiCreatedResponse({ standardSchema: UserSchema })
  async getUserByEmail(@Param('email') email: string): Promise<UserDto | null | Error> {
    try {
      return this.userService.getUserByEmail(email);
    } catch (error) {
      return error as Error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiCreatedResponse({ standardSchema: UserSchema })
  async getAllUsers(): Promise<UserDto[]> {
    return this.userService.getAllUsers();
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiCreatedResponse({ standardSchema: UserSchema })
  async updateUser(
    @Param('id') id: string,
    @Body() data: Partial<NewUserDto>,
  ): Promise<UserDto> {
    return this.userService.updateUser(id, data);
  }

  @Delete(':email')
  @ApiOperation({ summary: 'Delete existing user by email' })
  async deleteUser(@Param('email') email: string): Promise<UserDto | null> {
    return this.userService.deleteByEmail(email);
  }
}
