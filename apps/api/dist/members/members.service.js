"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembersService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@ntp/db");
let MembersService = class MembersService {
    async list({ q, party, active = true }) {
        const where = {};
        if (active) {
            where.AND = where.AND || [];
            where.AND.push({
                OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            });
        }
        if (q) {
            where.AND = where.AND || [];
            where.AND.push({
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { surname: { contains: q, mode: "insensitive" } },
                    { party: { abbreviation: { contains: q, mode: "insensitive" } } },
                    { party: { name: { contains: q, mode: "insensitive" } } },
                ],
            });
        }
        if (party) {
            where.party = {
                OR: [
                    { abbreviation: { equals: party, mode: "insensitive" } },
                    { name: { equals: party, mode: "insensitive" } },
                ],
            };
        }
        const members = await db_1.prisma.mp.findMany({
            where,
            orderBy: { surname: "asc" },
            include: {
                party: {
                    select: {
                        id: true,
                        name: true,
                        abbreviation: true,
                        colorNeutral: true,
                    },
                },
                _count: {
                    select: {
                        sponsors: true,
                        voteRecords: true,
                    },
                },
            },
        });
        return members;
    }
    async get(idOrTkId) {
        const member = await this.findMember(idOrTkId);
        // Get sponsored motions
        const motions = await db_1.prisma.motion.findMany({
            where: {
                sponsors: {
                    some: {
                        mpId: member.id,
                    },
                },
            },
            orderBy: { dateIntroduced: "desc" },
            take: 20,
            include: {
                sponsors: {
                    where: {
                        mpId: member.id,
                    },
                    select: {
                        role: true,
                    },
                },
                votes: {
                    select: {
                        result: true,
                        totalFor: true,
                        totalAgainst: true,
                    },
                    take: 1,
                },
            },
        });
        // Get voting stats
        const voteStats = await this.getMemberVoteStats(member.id);
        return {
            ...member,
            motions,
            voteStats,
        };
    }
    async getMemberVoteStats(mpId) {
        const records = await db_1.prisma.voteRecord.findMany({
            where: {
                mpId,
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
        let totalAbsent = 0;
        for (const record of records) {
            switch (record.voteValue) {
                case "FOR":
                    totalFor++;
                    break;
                case "AGAINST":
                    totalAgainst++;
                    break;
                case "ABSTAIN":
                    totalAbstain++;
                    break;
                case "ABSENT":
                    totalAbsent++;
                    break;
            }
        }
        return {
            totalVotes: records.length,
            for: totalFor,
            against: totalAgainst,
            abstain: totalAbstain,
            absent: totalAbsent,
            participationRate: records.length > 0
                ? ((records.length - totalAbsent) / records.length) * 100
                : 0,
        };
    }
    async findMember(idOrTkId) {
        const byId = await db_1.prisma.mp.findUnique({
            where: { id: idOrTkId },
            include: {
                party: {
                    select: {
                        id: true,
                        name: true,
                        abbreviation: true,
                        colorNeutral: true,
                    },
                },
            },
        });
        if (byId)
            return byId;
        const byTkId = await db_1.prisma.mp.findUnique({
            where: { tkId: idOrTkId },
            include: {
                party: {
                    select: {
                        id: true,
                        name: true,
                        abbreviation: true,
                        colorNeutral: true,
                    },
                },
            },
        });
        if (!byTkId) {
            throw new common_1.NotFoundException("Member not found");
        }
        return byTkId;
    }
};
exports.MembersService = MembersService;
exports.MembersService = MembersService = __decorate([
    (0, common_1.Injectable)()
], MembersService);
