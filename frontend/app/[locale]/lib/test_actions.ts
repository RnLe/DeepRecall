// Import API Token from .env file (in root directory)
require('dotenv').config()

const API_TOKEN = process.env.API_TOKEN

export const fetchProfiles = async () => {
    const data = await fetch('http://backend:1337/api/profiles', {
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`
        }
    })
    const profiles = await data.json()
    return profiles
}