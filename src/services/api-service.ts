import axios from 'axios';
// Assuming AppConfig exists if needed elsewhere, otherwise remove this import
// import { AppConfig } from '../config/app.config';

/**
 * Service class for handling all API interactions.
 */
export class ApiService {
  private static BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

  /**
   * Registers a new company owner account.
   * @param userData Object containing signup details (email, company_name, etc.).
   * @returns A Promise that resolves with the successful API response data.
   */
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
      // Re-throw a more specific error to be caught by the calling component/hook
      let errorMessage = 'Failed to register company.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Authenticates a user using provided credentials and logs them in.
   * @param loginData Object containing username/email and password.
   * @returns A Promise that resolves with the successful API response data (token, user info).
   */
  public static async loginUser(loginData: {
    email: string;
    password: string;
  }): Promise<any> {
    const endpoint = `${ApiService.BASE_URL}/auth/login`;

    try {
      const response = await axios.post(endpoint, loginData);
      return response.data;
    } catch (error) {
      console.error('Error during user login:', error);
      // Re-throw a more specific error to be caught by the calling component/hook
      let errorMessage = 'Failed to log in.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  public static async googleLogin(idToken: string): Promise<any> {
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



}