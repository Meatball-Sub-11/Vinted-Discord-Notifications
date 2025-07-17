import fetch from 'node-fetch';
import { authManager } from './auth-manager.js';
import logger from '../utils/logger.js';

// A custom error class to include more context
class VintedAPIError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'VintedAPIError';
        this.status = status;
    }
}

//general fucntion to make an authorized request
export const authorizedRequest = async ({
    method, 
    url, 
    oldUrl = null,
    search = false,
    logs = true
} = {}) => {
    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome",
            "Host": new URL(url).host,
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Connection": "keep-alive",
            "TE": "trailers",
            "DNT": 1
        };

        if (search) { //cookies from cookies.json
            const cookies = authManager.getCookies();
            headers["Cookie"] = Object.entries(cookies)
                .filter(([, value]) => value)
                .map(([key, value]) => `${key}=${value}`)
                .join('; ');
            headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
            headers["Accept-Language"] = "en-US,en;q=0.5";
            headers["Priority"] = "u=0, i";
            headers["Sec-Fetch-Dest"] = "document";
            headers["Sec-Fetch-Mode"] = "navigate";
            headers["Sec-Fetch-Site"] = "cross-site";
            headers["Upgrade-Insecure-Requests"] = "1";
        }
        if (logs) {
            logger.info(`Making an authed request to ${url}`);
        }

        const options = {
            "method": method,
            "headers": headers,
        };
        if (oldUrl) {
            options.headers["Referer"] = oldUrl;
        }

        let response = await fetch(url, options);

        while ([301, 302, 303, 307, 308].includes(response.status)) {
            const newUrl = response.headers.get('Location');
            logger.info(`Redirected to ${newUrl}`);
            response = await fetch(newUrl, options);
        }

        // Throw a detailed error for bad responses
        if (!response.ok) {
            throw new VintedAPIError(`HTTP status: ${response.status}`, response.status);
        }

        if (response.headers.get('Content-Type')?.includes('text/html')) {
            logger.warn("Response is HTML, not JSON. This might indicate an issue like a CAPTCHA.");
            return response.headers;
        }

        return await response.json();
    } catch (error) {
        // Re-throw the original error to preserve details like the status code
        throw error;
    }
};
