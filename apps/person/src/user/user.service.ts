import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

type newUserData = {
  email: string;
  passwordHash: string;
  onboardingRunId?: string | undefined;
};

type userData = {
  id: string;
  email: string;
  passwordHash: string;
  isProfileCompleted: boolean;
  onboardingRunId?: string | null;
  createdAt: Date;
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async createUser(data: newUserData) {
    data.passwordHash = await this.authService.hashPassword(data.passwordHash);
    return this.prisma.person.create({ data });
  }

  async getUserById(id: string): Promise<userData | null> {
    const user = await this.prisma.person.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserByEmail(email: string): Promise<userData | null> {
    const user = await this.prisma.person.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Email not found');
    return user;
  }

  async updateUser(id: string, data: Partial<newUserData>): Promise<userData> {
    return this.prisma.person.update({ where: { id }, data });
  }

  async getAllUsers(): Promise<userData[]> {
    return this.prisma.person.findMany();
  }

  async deleteByEmail(email: string): Promise<userData | null> {
    await this.getUserByEmail(email);
    return this.prisma.person.delete({ where: { email } });
  }
}
