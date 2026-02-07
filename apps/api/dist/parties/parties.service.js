"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartiesService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@ntp/db");
let PartiesService = class PartiesService {
    async list() {
        const parties = await db_1.prisma.party.findMany({
            where: {
                // Only active parties (no end date or end date in future)
                OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            },
            orderBy: { abbreviation: "asc" },
            include: {
                _count: {
                    select: {
                        mps: true,
                    },
                },
            },
        });
        return parties;
    }
    async get(idOrAbbr) {
        const party = await this.findParty(idOrAbbr);
        // Get current MPs
        const mps = await db_1.prisma.mp.findMany({
            where: {
                partyId: party.id,
                OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            },
            orderBy: { surname: "asc" },
            select: {
                id: true,
                tkId: true,
                name: true,
                surname: true,
                startDate: true,
                endDate: true,
            },
        });
        // Get voting stats
        const voteStats = await this.getPartyVoteStats(party.id);
        return {
            ...party,
            mps,
            voteStats,
        };
    }
    async getPartyVoteStats(partyId) {
        const records = await db_1.prisma.voteRecord.findMany({
            where: {
                partyIdSnapshot: partyId,
                vote: {
                    date: {
                        gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
                    },
                },
            },
            include: {
                vote: {
                    select: {
                        result: true,
                    },
                },
            },
        });
        let totalFor = 0;
        let totalAgainst = 0;
        let totalAbstain = 0;
        let votesWon = 0;
        let votesLost = 0;
        for (const record of records) {
            switch (record.voteValue) {
                case "FOR":
                    totalFor++;
                    if (record.vote.result === "Aangenomen")
                        votesWon++;
                    break;
                case "AGAINST":
                    totalAgainst++;
                    if (record.vote.result === "Verworpen")
                        votesWon++;
                    break;
                case "ABSTAIN":
                    totalAbstain++;
                    break;
            }
        }
        return {
            totalVotes: records.length,
            for: totalFor,
            against: totalAgainst,
            abstain: totalAbstain,
            votesWon,
            votesLost: records.length - votesWon - totalAbstain,
        };
    }
    async findParty(idOrAbbr) {
        const byId = await db_1.prisma.party.findUnique({
            where: { id: idOrAbbr },
        });
        if (byId)
            return byId;
        const byTkId = await db_1.prisma.party.findUnique({
            where: { tkId: idOrAbbr },
        });
        if (byTkId)
            return byTkId;
        const byAbbr = await db_1.prisma.party.findFirst({
            where: {
                abbreviation: {
                    equals: idOrAbbr,
                    mode: "insensitive",
                },
            },
        });
        if (!byAbbr) {
            throw new common_1.NotFoundException("Party not found");
        }
        return byAbbr;
    }
};
exports.PartiesService = PartiesService;
exports.PartiesService = PartiesService = __decorate([
    (0, common_1.Injectable)()
], PartiesService);
