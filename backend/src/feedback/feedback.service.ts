import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';

const MAX_WEEKLY_FEEDBACK = 3;

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, text: string) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const count = await this.prisma.feedback.count({
      where: { userId, createdAt: { gte: weekAgo } },
    });

    if (count >= MAX_WEEKLY_FEEDBACK) {
      throw new BadRequestException(
        'You can only submit 3 feedback entries per week',
      );
    }

    return this.prisma.feedback.create({
      data: { userId, text },
    });
  }

  async getMyFeedback(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getAll(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, username: true } } },
      }),
      this.prisma.feedback.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
