import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileLinksService } from '../profile-links/profile-links.service.js';
import { PROFILE_COMPLETED_EVENT, profileScope } from '@contracts';

import { hatchet } from '../hatchet/client.js';


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
    personId: string;
    createdAt: Date;
}

@Injectable()
export class InfoService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly links: ProfileLinksService,
    ) { }

    async getProfile(token: string) {
        const link = await this.links.requireActive(token);
        return { personId: link.personId, expiresAt: link.expiresAt };
    }

    async submit(token: string, data: newInfoRecord) {
        const link = await this.links.requireActive(token);
        await hatchet.events.push(
            PROFILE_COMPLETED_EVENT,
            { personId: link.personId, ...data },
            { scope: profileScope(link.personId) },
        );
        return { personId: link.personId };
    }

    async saveCompletedProfile(personId: string, data: Omit<newInfoRecord, 'personId'>) {
        return this.prisma.$transaction(async (tx) => {
            const info = await tx.info.upsert({
                where: { personId },
                create: { ...data, personId },
                update: data,
            });
            await tx.profileLink.update({
                where: { personId },
                data: { usedAt: new Date() },
            });
            return info;
        });
    }

    async getInfoById(id: string): Promise<infoRecord> {
        return await this.prisma.info.findUniqueOrThrow({ where: { id } })
    }

    async getAllInfo(): Promise<infoRecord[]> {
        return await this.prisma.info.findMany()
    }

}
