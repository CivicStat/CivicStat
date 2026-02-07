"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotesService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@ntp/db");
let VotesService = class VotesService {
    async list({ query, party, result, limit, offset }) {
        const where = {};
        if (query) {
            where.title = { contains: query, mode: "insensitive" };
        }
        if (result) {
            where.result = result;
        }
        const [items, total] = await Promise.all([
            db_1.prisma.vote.findMany({
                where,
                orderBy: { date: "desc" },
                skip: offset,
                take: limit,
                include: {
                    motion: {
                        select: {
                            id: true,
                            tkId: true,
                            title: true,
                            tkNumber: true,
                        },
                    },
                    _count: {
                        select: { records: true },
                    },
                },
            }),
            db_1.prisma.vote.count({ where }),
        ]);
        return {
            items,
            total,
            limit,
            offset,
        };
    }
    async get(idOrTkId) {
        const vote = await this.findVote(idOrTkId);
        // Include full voting records with MP and party info
        const records = await db_1.prisma.voteRecord.findMany({
            where: { voteId: vote.id },
            include: {
                mp: {
                    select: {
                        id: true,
                        tkId: true,
                        name: true,
                        surname: true,
                    },
                },
                party: {
                    select: {
                        id: true,
                        name: true,
                        abbreviation: true,
                        colorNeutral: true,
                    },
                },
            },
            orderBy: {
                party: {
                    abbreviation: "asc",
                },
            },
        });
        // Aggregate by party
        const partyStats = await this.getPartyStats(vote.id);
        return {
            ...vote,
            records,
            partyStats,
        };
    }
    async getPartyStats(voteId) {
        const records = await db_1.prisma.voteRecord.findMany({
            where: { voteId },
            include: {
                party: {
                    select: {
                        id: true,
                        name: true,
                        abbreviation: true,
                    },
                },
            },
        });
        // Group by party
        const partyMap = new Map();
        for (const record of records) {
            const key = record.party.id;
            if (!partyMap.has(key)) {
                partyMap.set(key, {
                    party: record.party,
                    for: 0,
                    against: 0,
                    abstain: 0,
                    absent: 0,
                    total: 0,
                });
            }
            const stats = partyMap.get(key);
            stats.total++;
            switch (record.voteValue) {
                case "FOR":
                    stats.for++;
                    break;
                case "AGAINST":
                    stats.against++;
                    break;
                case "ABSTAIN":
                    stats.abstain++;
                    break;
                case "ABSENT":
                    stats.absent++;
                    break;
            }
        }
        return Array.from(partyMap.values()).sort((a, b) => a.party.abbreviation.localeCompare(b.party.abbreviation));
    }
    async findVote(idOrTkId) {
        const byId = await db_1.prisma.vote.findUnique({
            where: { id: idOrTkId },
            include: {
                motion: {
                    select: {
                        id: true,
                        tkId: true,
                        title: true,
                        tkNumber: true,
                        text: true,
                    },
                },
            },
        });
        if (byId)
            return byId;
        const byTkId = await db_1.prisma.vote.findUnique({
            where: { tkId: idOrTkId },
            include: {
                motion: {
                    select: {
                        id: true,
                        tkId: true,
                        title: true,
                        tkNumber: true,
                        text: true,
                    },
                },
            },
        });
        if (!byTkId) {
            throw new common_1.NotFoundException("Vote not found");
        }
        return byTkId;
    }
};
exports.VotesService = VotesService;
exports.VotesService = VotesService = __decorate([
    (0, common_1.Injectable)()
], VotesService);
