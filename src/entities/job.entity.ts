import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export type JobStatus = "pending" | "done";

@Entity({ name: "jobs" })
export class Job {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id!: string;

    @Column({ type: "text" })
    type!: string;

    @Column({ type: "jsonb" })
    payload!: Record<string, unknown>;

    @Column({ type: "text" })
    status!: JobStatus;

    @Column({ type: "int", default: 0 })
    processed!: number;

    @Column({ type: "text", name: "worker_id", nullable: true })
    workerId!: string | null;

    @CreateDateColumn({ type: "timestamptz", name: "created_at" })
    createdAt!: Date;
}