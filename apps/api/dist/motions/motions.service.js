"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotionsService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@ntp/db");
let MotionsService = class MotionsService {
    async list({ query, party, status, limit, offset }) {
        const where = {};
        if (query) {
            where.OR = [
                { title: { contains: query, mode: "insensitive" } },
                { text: { contains: query, mode: "insensitive" } },
            ];
        }
        if (status) {
            where.status = status;
        }
        // If filtering by party, join through sponsors
        if (party) {
            where.sponsors = {
                some: {
                    mp: {
                        party: {
                            OR: [
                                { abbreviation: { equals: party, mode: "insensitive" } },
                                { name: { equals: party, mode: "insensitive" } },
                            ],
                        },
                    },
                },
            };
        }
        const [items, total] = await Promise.all([
            db_1.prisma.motion.findMany({
                where,
                orderBy: { dateIntroduced: "desc" },
                skip: offset,
                take: limit,
                include: {
                    sponsors: {
                        include: {
                            mp: {
                                select: {
                                    id: true,
                                    name: true,
                                    surname: true,
                                    party: {
                                        select: {
                                            id: true,
                                            name: true,
                                            abbreviation: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    vote: {
                        select: {
                            id: true,
                            tkId: true,
                            result: true,
                            totalFor: true,
                            totalAgainst: true,
                            totalAbstain: true,
                        },
                    },
                },
            }),
            db_1.prisma.motion.count({ where }),
        ]);
        return {
            items,
            total,
            limit,
            offset,
        };
    }
    async get(idOrTkId) {
        const motion = await this.findMotion(idOrTkId);
        // Get full vote details if exists
        const vote = motion.vote
            ? await db_1.prisma.vote.findUnique({
                where: { id: motion.vote.id },
                include: {
                    records: {
                        include: {
                            mp: {
                                select: {
                                    id: true,
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
                    },
                },
            })
            : null;
        return {
            ...motion,
            vote,
        };
    }
    async findMotion(idOrTkId) {
        const byId = await db_1.prisma.motion.findUnique({
            where: { id: idOrTkId },
            include: {
                sponsors: {
                    include: {
                        mp: {
                            select: {
                                id: true,
                                tkId: true,
                                name: true,
                                surname: true,
                                party: {
                                    select: {
                                        id: true,
                                        name: true,
                                        abbreviation: true,
                                        colorNeutral: true,
                                    },
                                },
                            },
                        },
                    },
                },
                vote: {
                    select: {
                        id: true,
                        tkId: true,
                        date: true,
                        result: true,
                        totalFor: true,
                        totalAgainst: true,
                        totalAbstain: true,
                    },
                },
            },
        });
        if (byId)
            return byId;
        const byTkId = await db_1.prisma.motion.findUnique({
            where: { tkId: idOrTkId },
            include: {
                sponsors: {
                    include: {
                        mp: {
                            select: {
                                id: true,
                                tkId: true,
                                name: true,
                                surname: true,
                                party: {
                                    select: {
                                        id: true,
                                        name: true,
                                        abbreviation: true,
                                        colorNeutral: true,
                                    },
                                },
                            },
                        },
                    },
                },
                vote: {
                    select: {
                        id: true,
                        tkId: true,
                        date: true,
                        result: true,
                        totalFor: true,
                        totalAgainst: true,
                        totalAbstain: true,
                    },
                },
            },
        });
        if (!byTkId) {
            throw new common_1.NotFoundException("Motion not found");
        }
        return byTkId;
    }
};
exports.MotionsService = MotionsService;
exports.MotionsService = MotionsService = __decorate([
    (0, common_1.Injectable)()
], MotionsService);
