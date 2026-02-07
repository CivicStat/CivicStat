"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotesController = void 0;
const common_1 = require("@nestjs/common");
const votes_service_1 = require("./votes.service");
let VotesController = class VotesController {
    votesService;
    constructor(votesService) {
        this.votesService = votesService;
    }
    async list(q, party, result, limit, offset) {
        const parsedLimit = Math.min(Number(limit ?? 20), 100);
        const parsedOffset = Math.max(Number(offset ?? 0), 0);
        return this.votesService.list({
            query: q,
            party,
            result,
            limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
            offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
        });
    }
    async get(id) {
        return this.votesService.get(id);
    }
};
exports.VotesController = VotesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("q")),
    __param(1, (0, common_1.Query)("party")),
    __param(2, (0, common_1.Query)("result")),
    __param(3, (0, common_1.Query)("limit")),
    __param(4, (0, common_1.Query)("offset")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], VotesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VotesController.prototype, "get", null);
exports.VotesController = VotesController = __decorate([
    (0, common_1.Controller)("votes"),
    __metadata("design:paramtypes", [votes_service_1.VotesService])
], VotesController);
