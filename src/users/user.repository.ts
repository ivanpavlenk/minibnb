import { DataSource } from "typeorm";
import { User, UserRole } from "../entities/user.entity";

export type NewUser = {
    email: string;
    role: UserRole;
    balanceCents?: number;
};

export class UserRepository {
    constructor(private readonly dataSource: DataSource) {}

    async save(input: NewUser): Promise<User> {
        const repo = this.dataSource.getRepository(User);
        return repo.save(
            repo.create({
                email: input.email,
                role: input.role,
                balanceCents: input.balanceCents ?? 0,
            }),
        );
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.dataSource.getRepository(User).findOne({ where: { email } });
    }

    async upsertByEmail(input: NewUser): Promise<User> {
        const rows: Array<{
            id: string;
            email: string;
            role: UserRole;
            created_at: Date;
            balance_cents: number;
        }> = await this.dataSource.query(
            `INSERT INTO users (email, role, balance_cents)
             VALUES ($1, $2, $3)
             ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
             RETURNING id, email, role, created_at, balance_cents`,
            [input.email, input.role, input.balanceCents ?? 0],
        );
        const row = rows[0];
        const user = new User();
        user.id = String(row.id);
        user.email = row.email;
        user.role = row.role;
        user.createdAt = row.created_at;
        user.balanceCents = row.balance_cents;
        return user;
    }
}