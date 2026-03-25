from setuptools import find_packages, setup

setup(
    name="agentgate",
    version="0.1.0",
    description="Python SDK for AgentGate — authorization gateway for AI agents",
    packages=find_packages(exclude=["tests*"]),
    python_requires=">=3.10",
    install_requires=["httpx>=0.28.0"],
)
