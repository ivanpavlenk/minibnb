export type Listing = {
  id: number;
  title: string;
  city: string;
  price_cents: number;
};

export type Booking = {
  id: number;
  listing_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  total_cents: number;
  status: 'confirmed' | 'cancelled';
};

export type CreateBookingRequest = {
  listing_id: number;
  check_in: string;
  check_out: string;
  guests: number;
};

export type ListingPage = {
  items: Listing[];
  next_cursor: string | null;
};
