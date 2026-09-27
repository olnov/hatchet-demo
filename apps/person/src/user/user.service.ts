import { Injectable } from '@nestjs/common';
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
    constructor(private readonly prisma: PrismaService, private readonly authService: AuthService) { }
    
    async createUser(data: newUserData) {
        data.passwordHash = await this.authService.hashPassword(data.passwordHash);
        return this.prisma.person.create({ data });
    }

    async getUserById(id: string): Promise<userData | null> {
        return this.prisma.person.findUnique({ where: { id } });
    }

    async getUserByEmail(email: string): Promise<userData | null> {
        return this.prisma.person.findUnique({ where: { email } });
    }

    async updateUser(id: string, data: Partial<newUserData>): Promise<userData> {
        return this.prisma.person.update({ where: { id }, data });
    }
}

