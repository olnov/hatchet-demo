import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileLinksService } from '../profile-links/profile-links.service.js';
import { PersonClient } from '../person-client/person-client.service.js';


type newInfoRecord = {
    firstName: string;
    lastName: string;
    personId: string;
    personalStatement: string;
}

type infoRecord = {
    id: string;
    firstName: string;
    lastName: string;
    personalStatement: string;
    personId: string;
    createdAt: Date;
}

@Injectable()
export class InfoService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly links: ProfileLinksService,
        private readonly personClient: PersonClient,
    ) { }

    async getProfile(token: string) {
        const link = await this.links.requireActive(token);
        return { personId: link.personId, expiresAt: link.expiresAt };
    }

    async submit(token: string, data: newInfoRecord) {
        const link = await this.links.requireActive(token);
        const info = await this.prisma.info.create({ data: { ...data, personId: link.personId } });
        await this.links.markUsed(token);
        await this.personClient.markProfileCompleted(link.personId);
        return { profileId: info.id, personId: link.personId };
    }

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
