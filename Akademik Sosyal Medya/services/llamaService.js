const axios = require('axios');
const { LLAMA_API_URL, DEFAULT_LLAMA_MODEL } = require('../config/constants');

exports.sendToLLaMA = async (prompt) => {
  const response = await axios.post(LLAMA_API_URL, {
    model: DEFAULT_LLAMA_MODEL,
    prompt,
    stream: false,
    options: {
      temperature: 0.7,
      top_k: 40,
      top_p: 0.9,
      repeat_penalty: 1.1,
      num_predict: 2000
    }
  });

  return response.data.response;
};
