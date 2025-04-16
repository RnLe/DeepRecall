# ----------------- Imports -----------------
import logging

from fastapi import APIRouter
import torch
import cpuinfo
import psutil

from dotenv import load_dotenv  # new import to load .env file
load_dotenv()  # load environment variables from .env

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

AVATARS_DIR = "avatars"
CONVERSATIONS_DIR = "conversations"

router = APIRouter()

@router.get("/hardware")
async def hardware_check():
    """
    Hardware-check endpoint to determine if a GPU is available and return details about the hardware.
    """
    # CPU information using cpuinfo and psutil
    cpu_info = cpuinfo.get_cpu_info()
    cpu_brand = cpu_info.get('brand_raw', 'Unknown')
    cpu_arch = cpu_info.get('arch', 'Unknown')
    cpu_freq = psutil.cpu_freq()
    cpu_freq_current = cpu_freq.current if cpu_freq else None
    cpu_count_physical = psutil.cpu_count(logical=False)
    cpu_count_logical = psutil.cpu_count(logical=True)

    cpu_data = {
        "available": True,
        "brand": cpu_brand,
        "architecture": cpu_arch,
        "physicalCores": cpu_count_physical,
        "logicalCores": cpu_count_logical,
        "frequencyCurrentMHz": round(cpu_freq_current, 2) if cpu_freq_current else None,
    }
    
    # GPU information using PyTorch
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        gpu_props = torch.cuda.get_device_properties(0)
        # Convert total memory from bytes to gigabytes
        gpu_total_memory_GB = gpu_props.total_memory / (1024 ** 3)
        gpu_data = {
            "available": True,
            "name": gpu_name,
            "totalMemoryGB": round(gpu_total_memory_GB, 2),
            "computeCapability": f"{gpu_props.major}.{gpu_props.minor}",
            "multiProcessorCount": gpu_props.multi_processor_count,
        }
    else:
        gpu_data = {"available": False}
        
    return {
        "cpu": cpu_data,
        "gpu": gpu_data,
        "torchVersion": torch.__version__,
        "cudaAvailable": torch.cuda.is_available(),
        "cudaVersion": torch.version.cuda if torch.cuda.is_available() else None,
    }