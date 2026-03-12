import axios from 'axios';
import { forceHttpsWhenPageIsHttps } from '../../utils/forceHttpsWhenPageIsHttps';

const baseURL = forceHttpsWhenPageIsHttps(
  process.env.REACT_APP_API_URL || 'http://localhost:5000'
);

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});
export default api;