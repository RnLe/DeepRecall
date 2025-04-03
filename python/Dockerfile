# Use the latest CUDA runtime image from NVIDIA (adjust the tag as needed)
FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

# Install system dependencies needed for Miniconda
RUN apt-get update && apt-get install -y ffmpeg wget bzip2 && apt-get clean

# Install Miniconda
ENV PATH=/opt/conda/bin:$PATH
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh && \
    /bin/bash /tmp/miniconda.sh -b -p /opt/conda && \
    rm /tmp/miniconda.sh && \
    apt-get clean

# Copy the environment file and create the conda environment
WORKDIR /app
COPY environment.yml /app/
RUN conda install -n base -c conda-forge mamba
RUN mamba env create -f environment.yml && mamba clean -a

# Activate the environment for subsequent commands
ENV PATH /opt/conda/envs/python-api/bin:$PATH

# Copy your application code into the container
COPY . /app

# Expose the port that your FastAPI app will run on
EXPOSE 8000

# Run the FastAPI app (assuming your FastAPI instance is in api.py and named "app")
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]