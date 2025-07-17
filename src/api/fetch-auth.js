import { authorizedRequest } from './make-request.js';
import { authManager } from './auth-manager.js';
import logger from '../utils/logger.js';

//helper to extract cookie value from the header string
const extractCookieValue = (header, name) => {
    const regex = new RegExp(`${name}=([^;]+)`);
    const match = header.match(regex);
    return match ? match[1] : null;
};

//fetch cookies for the search session with no privileges
export const fetchCookies = async () => {
    try{
        const headers = await authorizedRequest({
            method: "HEAD",
            url: `${process.env.BASE_URL}/how_it_works`
        });

        const setCookie = headers.raw()['set-cookie'];
        const sessionCookiesArray = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
        if (!sessionCookiesArray || sessionCookiesArray.length === 0) {
            throw new Error("Set-Cookie headers not found in the response");
        }
        const cookieHasAccessToken = sessionCookiesArray.some(cookie => cookie.includes('access_token_web'));
        if (cookieHasAccessToken) {
            logger.info('Refreshing Vinted session cookies.');
            //get all set-cookies and extract their values to construct the cookie string
            const cookieHeader = sessionCookiesArray
                .map(cookie => cookie.split(';')[0].trim())
                .join('; ');
            const cookieObject = {
                refresh: extractCookieValue(cookieHeader, 'refresh_token_web'),
                access: extractCookieValue(cookieHeader, 'access_token_web'),
                vinted: extractCookieValue(cookieHeader, '_vinted_fr_session')
            };
            await authManager.setCookies(cookieObject);
        }
    } catch (error) {
        // Re-throw the original error to preserve the stack trace and specific details.
        // This is crucial for the calling function to log the full error.
        throw error;
    }
};
