/** @type {import('next').NextConfig} */
 
module.exports = {
  experimental: {
    optimizeCss: true, // Ensure CSS is optimized and preloaded correctly
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.css$/,
      use: [
        {
          loader: 'css-loader',
          options: {
            importLoaders: 1,
          },
        },
      ],
    });
    return config;
  },
};