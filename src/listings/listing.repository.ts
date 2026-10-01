import { DataSource } from 'typeorm';
import { Listing } from '../entities/listing.entity';

export type NewListing = {
    ownerId: string;
    title: string;
    city: string;
    pricePerNight: number;
    stock?: number;
};

export class ListingRepository {
    constructor(private readonly dataSource: DataSource) {}

    async save(input: NewListing): Promise<Listing> {
        const repo = this.dataSource.getRepository(Listing);
        return repo.save(
            repo.create({
                ownerId: input.ownerId,
                title: input.title,
                city: input.city,
                pricePerNight: input.pricePerNight,
                stock: input.stock ?? 1,
            }),
        );
    }

    async findById(id: string): Promise<Listing | null> {
        return this.dataSource.getRepository(Listing).findOne({ where: { id } });
    }

    async findWithOwner(id: string): Promise<Listing | null> {
        return this.dataSource
            .createQueryBuilder(Listing, 'listing')
            .innerJoinAndSelect('listing.owner', 'owner')
            .where('listing.id = :id', { id })
            .getOne();
    }

    async countByCity(city: string): Promise<number> {
        const raw = await this.dataSource
            .createQueryBuilder(Listing, 'listing')
            .select('COUNT(listing.id)', 'cnt')
            .where('listing.city = :city', { city })
            .getRawOne<{ cnt: string }>();
        return Number(raw?.cnt ?? 0);
    }
}
