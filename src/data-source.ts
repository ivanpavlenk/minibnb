import "reflect-metadata";
import {join} from "path";
import {DataSource} from "typeorm";
import {User} from "./entities/user.entity";
import {Listing} from "./entities/listing.entity";
import {Booking} from "./entities/booking.entity";
import {Review} from "./entities/review.entity";
import {Job} from "./entities/job.entity";

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing env var ${name}`);
    }
    return value;
}

export const AppDataSource = new DataSource({
    type: "postgres",
    host: requiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? "5432"),
    username: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    synchronize: false,
    logging: false,
    entities: [User, Listing, Booking, Review, Job],
    migrations: [join(__dirname, "migrations", "*.js")],
});