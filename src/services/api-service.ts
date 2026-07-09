// ── API Service ──────────────────────────────────────────────
// Central HTTP service wrapping all backend endpoints. Handles auth token injection via
// axios interceptor and provides typed methods for auth, customers, transactions, trips,
// destinations, itineraries, days, flights, and accommodation CRUD operations.
//
// Not every method here is called from the UI yet — getItineraries/getItinerary/
// deleteItinerary/updateItineraryDay/updateFlight/updateAccommodation/getCustomer are fully
// wired to the backend but have no caller in src/pages or src/components today — they're here
// for whichever screen ends up needing them (e.g. a fuller "edit itinerary metadata" UI;
// updateItinerary itself IS used now, but only for its start_city field — see TripDetail.tsx's
// inline start-city editor). recordSubscriptionPayment is similarly unused now that
// Pricing.tsx pays through Moolre (initiateMoolreSubscriptionPayment) instead of recording a
// payment as already-completed — kept for a possible future "record an offline payment" flow.

import axios from 'axios';
import type { LoginResponse } from '../types/auth';
import type {
  DashboardResponse, ApiPaginatedResponse,
  CustomerResponse, TransactionResponse, TripResponse, TripCostResponse, ItineraryResponse, GenerateItineraryApiResponse,
  ItineraryDayResponse, ItineraryFlightResponse, ItineraryAccommodationResponse,
  DestinationResponse, AirportResponse, CompanyResponse, CallResponse, CallActionItemResponse,
  SubscriptionTierResponse, CompanySubscriptionResponse, MoolreCheckoutResponse,
  FlightSearchResponse, HotelSearchResponse,
} from '../types/app';

export class ApiService {
  private static BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
  private static authToken: string | null = null;

  static {
    axios.interceptors.request.use((config) => {
      if (ApiService.authToken) {
        config.headers.Authorization = `Bearer ${ApiService.authToken}`;
      }
      return config;
    });
  }

  public static setAuthToken(token: string | null) {
    ApiService.authToken = token;
  }

  // ── Auth ──
  public static async registerCompany(userData: {
    email: string;
    company_name: string;
    country: string;
    business_type: 'llc' | string;
    username: string;
    password: string;
    password_confirmation: string;
  }): Promise<any> {
    const endpoint = `${ApiService.BASE_URL}/auth/register-company`;

    try {
      const response = await axios.post(endpoint, userData);
      return response.data;
    } catch (error) {
      console.error('Error during company registration:', error);
      let errorMessage = 'Failed to register company.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  public static async loginUser(loginData: {
    email: string;
    password: string;
  }): Promise<LoginResponse> {
    const endpoint = `${ApiService.BASE_URL}/auth/login`;

    try {
      const response = await axios.post(endpoint, loginData);
      return response.data;
    } catch (error) {
      console.error('Error during user login:', error);
      let errorMessage = 'Failed to log in.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  public static async googleLogin(google: {
    idToken: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  }): Promise<LoginResponse> {
    const endpoint = `${ApiService.BASE_URL}/auth/login`

    try {
      const response = await axios.post(endpoint, {
        provider_token: google.idToken,
        email: google.email,
        display_name: google.displayName,
        avatar_url: google.avatarUrl,
      })
      return response.data
    } catch (error) {
      console.error('Error during Google sign-in:', error)
      let errorMessage = 'Failed to sign in with Google.'
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage
      }
      throw new Error(errorMessage)
    }
  }

  public static async requestPasswordReset( email : {
	email: string;
  }) : Promise<any> {
	const endpoint = `${ApiService.BASE_URL}/auth/forgot-password`;

	try {
		const response = await axios.post(endpoint, email);
		return response.data;
	} catch (error){
		console.log("An error occured when requesting for password reset",error);
		let errorMessage = "Failed to request a reset link";
		if (axios.isAxiosError(error) && error.message){
			errorMessage = error.response?.data.message || errorMessage;
		}
		throw new Error(errorMessage);
	}
  }


    public static async resetPassword( credentials : {
	email: string;
	token: string;
	password: string;
  password_confirmation: string;

  }) : Promise<any> {
	const endpoint = `${ApiService.BASE_URL}/auth/reset-password`;

	try {
		const response = await axios.post(endpoint, credentials);
		return response.data;
	} catch (error){
		console.log("An error occured when resetting the password",error);
		let errorMessage = "Failed to reset password";
		if (axios.isAxiosError(error) && error.message){
			errorMessage = error.response?.data.message || errorMessage;
		}
		throw new Error(errorMessage);
	}
  }

  public static async getMe(): Promise<{ user: LoginResponse['user'] }> {
    const response = await axios.get(`${ApiService.BASE_URL}/auth/me`);
    return response.data;
  }

  public static async updateProfile(payload: {
    display_name?: string;
    phone?: string | null;
    avatar_url?: string | null;
  }): Promise<LoginResponse['user']> {
    const endpoint = `${ApiService.BASE_URL}/auth/profile`;

    try {
      const response = await axios.put(endpoint, payload);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      let errorMessage = 'Failed to update profile.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  // ── Dashboard ──
  public static async getDashboard(): Promise<DashboardResponse> {
    const endpoint = `${ApiService.BASE_URL}/dashboard`;

    try {
      const response = await axios.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      let errorMessage = 'Failed to fetch dashboard data.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  // ── Customers ──
  public static async getCustomers(page = 1): Promise<ApiPaginatedResponse<CustomerResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/customers?page=${page}`);
    return res.data;
  }

  public static async getCustomer(id: string): Promise<CustomerResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/customers/${id}`);
    return res.data;
  }

  public static async createCustomer(data: {
    company_id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    date_of_birth?: string | null;
    passport_number?: string | null;
    notes?: string | null;
  }): Promise<CustomerResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/customers`, data);
    return res.data;
  }

  public static async updateCustomer(id: string, data: Partial<{
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    passport_number: string | null;
    notes: string | null;
    status: string;
  }>): Promise<CustomerResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/customers/${id}`, data);
    return res.data;
  }

  public static async deleteCustomer(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/customers/${id}`);
  }

  // ── Transactions ──
  public static async getTransactions(page = 1): Promise<ApiPaginatedResponse<TransactionResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/transactions?page=${page}`);
    return res.data;
  }

  public static async getTransaction(id: string): Promise<TransactionResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/transactions/${id}`);
    return res.data;
  }

  public static async recordTripPayment(data: {
    trip_id: string;
    amount: number;
    currency?: string;
    payment_method?: string;
    transaction_reference?: string;
    notes?: string;
    status?: string;
  }): Promise<TransactionResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/transactions/trip`, data);
    return res.data;
  }

  public static async recordSubscriptionPayment(data: {
    company_id: string;
    subscription_id: string;
    amount: number;
    currency?: string;
    payment_method?: string;
    transaction_reference?: string;
    status?: string;
  }): Promise<TransactionResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/transactions/subscription`, data);
    return res.data;
  }

  public static async updateTransactionStatus(id: string, status: string): Promise<TransactionResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/transactions/${id}/status`, { status });
    return res.data;
  }

  // ── Trips ──
  public static async getTrips(page = 1): Promise<ApiPaginatedResponse<TripResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/trips?page=${page}`);
    return res.data;
  }

  public static async getTrip(id: string): Promise<TripResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/trips/${id}`);
    return res.data;
  }

  public static async createTrip(data: {
    company_id: string;
    created_by?: string;
    trip_name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    budget?: string;
    status?: string;
  }): Promise<TripResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips`, data);
    return res.data;
  }

  public static async updateTrip(id: string, data: Partial<{
    trip_name: string;
    description: string;
    start_date: string;
    end_date: string;
    budget: string;
    status: string;
  }>): Promise<TripResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/trips/${id}`, data);
    return res.data;
  }

  public static async deleteTrip(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/trips/${id}`);
  }

  public static async updateTripStatus(id: string, status: string): Promise<TripResponse> {
    const res = await axios.patch(`${ApiService.BASE_URL}/trips/${id}/status`, { status });
    return res.data;
  }

  public static async getTripCosts(id: string): Promise<TripCostResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/trips/${id}/costs`);
    return res.data;
  }

  public static async generateItinerary(id: string, preferences?: {
    budget?: string;
    style?: string;
    priorities?: string[];
    notes?: string;
    start_city?: string;
    model?: string;
    include_flights?: boolean;
    include_stays?: boolean;
    include_events?: boolean;
    flight_departure_time?: string;
    return_flight_time?: string;
  }): Promise<GenerateItineraryApiResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips/${id}/generate-itinerary`, preferences ?? {});
    return res.data;
  }

  // Attaches a customer to a trip as its traveler (role defaults to 'primary' server-side).
  // Was already routed on the backend (TripController::addCustomer/removeCustomer) but never
  // exposed here — nothing in the UI could assign a traveler to a trip before this.
  public static async addCustomerToTrip(tripId: string, customerId: string, role?: 'primary' | 'companion'): Promise<TripResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips/${tripId}/customers`, { customer_id: customerId, role });
    return res.data;
  }

  public static async removeCustomerFromTrip(tripId: string, customerId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/trips/${tripId}/customers/${customerId}`);
  }

  // ── Company ──
  public static async createCompany(data: {
    company_name: string;
    country: string;
    business_type: string;
  }): Promise<CompanyResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/companies`, data);
    return res.data;
  }

  public static async getCompany(id: string): Promise<CompanyResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/companies/${id}`);
    return res.data;
  }

  public static async updateCompany(id: string, data: Partial<{
    company_name: string;
    country: string;
    city_of_operation: string;
  }>): Promise<CompanyResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/companies/${id}`, data);
    return res.data;
  }

  // ── Users (scoped to company) ──
  public static async getCompanyUsers(companyId: string): Promise<CompanyResponse> {
    return ApiService.getCompany(companyId);
  }

  // ── Invitations ──
  public static async sendInvitation(data: {
    company_id: string;
    invited_by: string;
    email: string;
    role?: string;
  }): Promise<any> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await axios.post(`${ApiService.BASE_URL}/invitations`, {
      ...data,
      token,
      expires_at: expiresAt,
    });
    return res.data;
  }

  // ── Destinations ──
  public static async getDestinations(page = 1): Promise<ApiPaginatedResponse<DestinationResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/destinations?page=${page}`);
    return res.data;
  }

  public static async createDestination(data: {
    name: string;
    country: string;
    url?: string;
  }): Promise<DestinationResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/destinations`, data);
    return res.data;
  }

  // ── Airports ──
  // City/country → IATA code lookup (see AirportController::search) — used by AddFlightModal's
  // From/To fields so agents don't need to memorize airport codes.
  public static async searchAirports(query: string): Promise<{ data: AirportResponse[] }> {
    const res = await axios.get(`${ApiService.BASE_URL}/airports/search`, { params: { q: query } });
    return res.data;
  }

  // ── Itinerary ──
  public static async getItineraries(): Promise<ApiPaginatedResponse<ItineraryResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary`);
    return res.data;
  }

  public static async getItinerary(id: string): Promise<ItineraryResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary/${id}`);
    return res.data;
  }

  public static async createItinerary(data: {
    trip_id: string;
    created_by?: string;
    itinerary_name: string;
    start_city?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ItineraryResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary`, data);
    return res.data;
  }

  public static async updateItinerary(id: string, data: Partial<{
    itinerary_name: string;
    start_city: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
  }>): Promise<ItineraryResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/${id}`, data);
    return res.data;
  }

  public static async deleteItinerary(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/${id}`);
  }

  // ── Itinerary Days ──
  public static async addItineraryDay(itineraryId: string, data: {
    day_number: number;
    date?: string;
    title?: string;
    description?: string;
    location?: string;
  }): Promise<ItineraryDayResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/${itineraryId}/days`, data);
    return res.data;
  }

  public static async updateItineraryDay(dayId: string, data: Partial<{
    day_number: number;
    date: string;
    title: string;
    description: string;
    location: string;
  }>): Promise<ItineraryDayResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/days/${dayId}`, data);
    return res.data;
  }

  public static async removeItineraryDay(dayId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/days/${dayId}`);
  }

  // ── Itinerary Flights ──
  public static async addFlight(itineraryId: string, data: {
    airline?: string;
    flight_number?: string;
    departure_airport?: string;
    arrival_airport?: string;
    departure_datetime?: string;
    arrival_datetime?: string;
    cost?: number;
    currency?: string;
    booking_reference?: string;
    booking_url?: string;
    status?: string;
  }): Promise<ItineraryFlightResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/${itineraryId}/flights`, data);
    return res.data;
  }

  public static async updateFlight(flightId: string, data: Partial<{
    airline: string;
    flight_number: string;
    departure_airport: string;
    arrival_airport: string;
    departure_datetime: string;
    arrival_datetime: string;
    cost: number;
    currency: string;
    booking_reference: string;
    booking_url: string;
    status: string;
  }>): Promise<ItineraryFlightResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/flights/${flightId}`, data);
    return res.data;
  }

  public static async removeFlight(flightId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/flights/${flightId}`);
  }

  // Real flight search via SerpApi's Google Flights engine (server-side — see
  // ItineraryController::searchFlights). Read-only; call addFlight() once per leg of
  // whichever FlightSearchResult the user picks to actually save it.
  public static async searchFlights(itineraryId: string, params: {
    departure_id: string;
    arrival_id: string;
    outbound_date: string;
    return_date?: string;
  }): Promise<FlightSearchResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary/${itineraryId}/flights/search`, { params });
    return res.data;
  }

  // ── Itinerary Accommodation ──
  public static async addAccommodation(itineraryId: string, data: {
    accommodation_name: string;
    address?: string;
    check_in_date?: string;
    check_out_date?: string;
    room_type?: string;
    cost?: number;
    currency?: string;
    booking_reference?: string;
    booking_url?: string;
    status?: string;
  }): Promise<ItineraryAccommodationResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/${itineraryId}/accommodation`, data);
    return res.data;
  }

  public static async updateAccommodation(accommodationId: string, data: Partial<{
    accommodation_name: string;
    address: string;
    check_in_date: string;
    check_out_date: string;
    room_type: string;
    cost: number;
    currency: string;
    booking_reference: string;
    booking_url: string;
    status: string;
  }>): Promise<ItineraryAccommodationResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/accommodation/${accommodationId}`, data);
    return res.data;
  }

  public static async removeAccommodation(accommodationId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/accommodation/${accommodationId}`);
  }

  // Real hotel/stay search via SerpApi's Google Hotels engine (server-side — see
  // ItineraryController::searchHotels). Read-only; call addAccommodation() with the picked
  // HotelSearchResult's fields to actually save it.
  public static async searchHotels(itineraryId: string, params: {
    q: string;
    check_in_date: string;
    check_out_date: string;
    adults?: number;
  }): Promise<HotelSearchResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary/${itineraryId}/accommodation/search`, { params });
    return res.data;
  }

  // ── Itinerary Day Destinations ──
  // Links a destination to a specific itinerary day with optional cost/activity/booking info
  public static async addDestinationToDay(dayId: string, data: {
    destination_id: string;
    item_type?: 'activity' | 'dining' | 'transfer' | 'venue';
    cost?: string;
    currency?: string;
    activities?: string;
    booking_url?: string;
  }): Promise<any> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/days/${dayId}/destinations`, data);
    return res.data;
  }

  // Removes a single destination from a day, without deleting the day itself — see
  // ItineraryController::removeDestinationFromDay on the backend.
  public static async removeDestinationFromDay(dayId: string, destinationId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/days/${dayId}/destinations/${destinationId}`);
  }

  // ── Calls ──
  // Optional tripId scopes the list to one trip — used by TripDetail.tsx's Calls tab.
  public static async getCalls(tripId?: string): Promise<ApiPaginatedResponse<CallResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/calls`, {
      params: tripId ? { trip_id: tripId } : undefined,
    });
    return res.data;
  }

  public static async getCall(id: string): Promise<CallResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/calls/${id}`);
    return res.data;
  }

  public static async createCall(data: {
    trip_id: string;
    organized_by?: string;
    title?: string;
    started_at?: string;
    meeting_link?: string;
  }): Promise<CallResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/calls`, data);
    return res.data;
  }

  public static async updateCall(id: string, data: Partial<{
    title: string;
    started_at: string;
    ended_at: string;
    meeting_link: string;
    notes: string;
    transcript: string;
  }>): Promise<CallResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/calls/${id}`, data);
    return res.data;
  }

  public static async deleteCall(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/calls/${id}`);
  }

  public static async endCall(id: string): Promise<CallResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/calls/${id}/end`);
    return res.data;
  }

  public static async addCallActionItem(callId: string, description: string): Promise<CallActionItemResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/calls/${callId}/action-items`, { description });
    return res.data;
  }

  public static async updateCallActionItem(id: string, data: Partial<{
    description: string;
    status: string;
  }>): Promise<CallActionItemResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/calls/action-items/${id}`, data);
    return res.data;
  }

  public static async removeCallActionItem(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/calls/action-items/${id}`);
  }

  // ── Subscriptions ──
  public static async getSubscriptionTiers(): Promise<ApiPaginatedResponse<SubscriptionTierResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/subscription-tiers`);
    return res.data;
  }

  // Returns the caller's own company's subscription history (most recent first) —
  // CompanySubscriptionController::index is scoped server-side, no company_id needed here.
  public static async getCompanySubscriptions(): Promise<ApiPaginatedResponse<CompanySubscriptionResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/company-subscriptions`);
    return res.data;
  }

  // Subscribes the caller's own company to a tier. Does not record a payment — call
  // recordSubscriptionPayment() separately with the returned subscription_id for that.
  public static async subscribeToTier(data: {
    tier_id: string;
    start_date: string;
    end_date: string;
    status?: string;
  }): Promise<CompanySubscriptionResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/company-subscriptions`, data);
    return res.data;
  }

  // ── Moolre payments (https://docs.moolre.com/) ──
  // Both initiate* calls create a pending Transaction server-side and return a hosted
  // checkout URL to redirect the customer to — see MoolrePaymentController. Payment
  // completion is confirmed by polling checkMoolrePaymentStatus() from the page the customer
  // lands back on (the Moolre webhook is best-effort and can't reach a local dev server).
  public static async initiateMoolreTripPayment(tripId: string, amount: number, notes?: string): Promise<MoolreCheckoutResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/payments/moolre/trip`, { trip_id: tripId, amount, notes });
    return res.data;
  }

  public static async initiateMoolreSubscriptionPayment(subscriptionId: string, amount: number): Promise<MoolreCheckoutResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/payments/moolre/subscription`, { subscription_id: subscriptionId, amount });
    return res.data;
  }

  public static async checkMoolrePaymentStatus(transactionId: string): Promise<TransactionResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/payments/moolre/${transactionId}/status`);
    return res.data;
  }
}
