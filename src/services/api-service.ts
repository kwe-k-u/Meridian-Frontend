// ── API Service ──────────────────────────────────────────────
// Central HTTP service wrapping all backend endpoints. Handles auth token injection via
// axios interceptor and provides typed methods for auth, customers, transactions, trips,
// destinations, itineraries, days, flights, and accommodation CRUD operations.

import axios from 'axios';
import type { LoginResponse } from '../types/auth';
import type {
  DashboardResponse, ApiPaginatedResponse,
  CustomerResponse, TransactionResponse, TripResponse, TripCostResponse, ItineraryResponse,
  ItineraryDayResponse, ItineraryFlightResponse, ItineraryAccommodationResponse,
  DestinationResponse, CompanyResponse,
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

  public static async googleLogin(idToken: string): Promise<LoginResponse> {
    const endpoint = `${ApiService.BASE_URL}/auth/google`

    try {
      const response = await axios.post(endpoint, { id_token: idToken })
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

  // ── Dashboard ──

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

  // ── Customers ──
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

  // ── Transactions ──
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

  // ── Company ──
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
    const token = Math.random().toString(36).substring(2, 15);
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
    country?: string;
    url?: string;
  }): Promise<DestinationResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/destinations`, data);
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
    description?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ItineraryResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary`, data);
    return res.data;
  }

  public static async updateItinerary(id: string, data: Partial<{
    itinerary_name: string;
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

  // ── Itinerary Flights ──
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

  // ── Itinerary Day Destinations ──
  // Links a destination to a specific itinerary day with optional cost/activity/booking info
  public static async addDestinationToDay(dayId: string, data: {
    destination_id: string;
    cost?: string;
    currency?: string;
    activities?: string;
    booking_url?: string;
  }): Promise<any> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/days/${dayId}/destinations`, data);
    return res.data;
  }
}
