const axios = require('axios');
const { SERPAPI_URL } = require('../../config/constants');

exports.searchAuthorId = async (query) => {
  const response = await axios.get(SERPAPI_URL, {
    params: {
      engine: 'google_scholar',
      q: query,
      api_key: process.env.SERPAPI_KEY
    }
  });

  return response.data?.profiles?.authors?.[0]?.author_id || null;
};

exports.fetchAuthorDetails = async (authorId) => {
  const response = await axios.get(SERPAPI_URL, {
    params: {
      engine: 'google_scholar_author',
      author_id: authorId,
      hl: 'tr',
      api_key: process.env.SERPAPI_KEY
    }
  });

  return response.data;
};
