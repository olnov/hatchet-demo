import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


type newInfoRecord = {
    firstName: string;
    lastName: string;
    personalStatement: string;
}

type infoRecord = {
    id: string;
    firstName: string;
    lastName: string;
    personalStatement: string;
    createdAt: Date;
}

@Injectable()
export class InfoService {
    constructor(private readonly prisma: PrismaService) { }

    async createInfo(data: newInfoRecord): Promise<infoRecord> {
        return await this.prisma.info.create({ data })
    }

    async getInfoById(id: string): Promise<infoRecord> {
        return await this.prisma.info.findUniqueOrThrow({ where: { id } })
    }

    async getAllInfo(): Promise<infoRecord[]> {
        return await this.prisma.info.findMany()
    }

}
