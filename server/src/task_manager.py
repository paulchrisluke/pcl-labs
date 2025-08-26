import time
import uuid
import hashlib
import secrets
import threading
from typing import Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class TaskStatus(Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class TaskRecord:
    task_id: str
    status: TaskStatus
    clip_ids: list[str]
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['status'] = self.status.value
        data['created_at'] = self.created_at.isoformat()
        if self.started_at:
            data['started_at'] = self.started_at.isoformat()
        if self.completed_at:
            data['completed_at'] = self.completed_at.isoformat()
        return data

class TaskManager:
    """Simple in-memory task manager for tracking background task status"""
    
    def __init__(self):
        self._tasks: Dict[str, TaskRecord] = {}
        self._lock = threading.Lock()  # Thread lock for thread safety
        self._max_retries = 10  # Maximum retries for ID generation
    
    def _generate_task_id(self) -> str:
        """Generate a unique task ID with collision detection"""
        # Combine multiple sources of randomness for better uniqueness
        timestamp = str(int(time.time() * 1000000))  # Microsecond precision
        random_uuid = str(uuid.uuid4())
        random_bytes = secrets.token_hex(8)
        
        # Create a hash combining all sources
        combined = f"{timestamp}-{random_uuid}-{random_bytes}"
        task_id = hashlib.sha256(combined.encode()).hexdigest()[:16]  # Use first 16 chars
        
        return task_id
    
    def _generate_unique_task_id(self) -> str:
        """Generate a unique task ID with retry logic for collision handling"""
        for attempt in range(self._max_retries):
            task_id = self._generate_task_id()
            
            # Check if this ID already exists
            if task_id not in self._tasks:
                return task_id
            
            logger.warning(f"Task ID collision detected on attempt {attempt + 1}, retrying...")
            time.sleep(0.001)  # Small delay to reduce collision probability
        
        # If we've exhausted retries, use a more aggressive approach
        logger.error(f"Failed to generate unique task ID after {self._max_retries} attempts")
        timestamp = str(int(time.time() * 1000000))
        random_suffix = secrets.token_hex(8)
        fallback_id = f"fallback-{timestamp}-{random_suffix}"
        
        if fallback_id in self._tasks:
            raise RuntimeError("Critical: Unable to generate unique task ID")
        
        return fallback_id
    
    def create_task(self, clip_ids: list[str]) -> str:
        """Create a new task record and return the task ID"""
        task_id = self._generate_unique_task_id()
        
        task_record = TaskRecord(
            task_id=task_id,
            status=TaskStatus.QUEUED,
            clip_ids=clip_ids,
            created_at=datetime.now(timezone.utc)
        )
        
        with self._lock:
            self._tasks[task_id] = task_record
        
        logger.info(f"Created task {task_id} for {len(clip_ids)} clips")
        return task_id
    
    def get_task(self, task_id: str) -> Optional[TaskRecord]:
        """Get a task record by ID"""
        with self._lock:
            return self._tasks.get(task_id)
    
    def update_task_status(self, task_id: str, status: TaskStatus, 
                          results: Optional[Dict[str, Any]] = None, 
                          error: Optional[str] = None) -> bool:
        """Update task status and optionally add results or error"""
        with self._lock:
            if task_id not in self._tasks:
                logger.error(f"Task {task_id} not found")
                return False
            
            task = self._tasks[task_id]
            task.status = status
            
            if status == TaskStatus.RUNNING and not task.started_at:
                task.started_at = datetime.now(timezone.utc)
            elif status in [TaskStatus.COMPLETED, TaskStatus.FAILED] and not task.completed_at:
                task.completed_at = datetime.now(timezone.utc)
            
            if results is not None:
                task.results = results
            
            if error is not None:
                task.error = error
        
        logger.info(f"Updated task {task_id} status to {status.value}")
        return True
    
    def list_tasks(self, limit: int = 50) -> list[Dict[str, Any]]:
        """List recent tasks with their status"""
        with self._lock:
            # Create a snapshot to avoid holding the lock during sorting
            task_snapshot = list(self._tasks.values())

        sorted_tasks = sorted(
            task_snapshot,
            key=lambda t: t.created_at,
            reverse=True
        )
        
        return [task.to_dict() for task in sorted_tasks[:limit]]
    
    def cleanup_old_tasks(self, max_age_hours: int = 24) -> int:
        """Clean up old completed/failed tasks to prevent memory bloat"""
        cutoff_time = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
        tasks_to_remove = []
        
        with self._lock:
            for task_id, task in self._tasks.items():
                if (task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED] and 
                    task.created_at.timestamp() < cutoff_time):
                    tasks_to_remove.append(task_id)
            
            for task_id in tasks_to_remove:
                del self._tasks[task_id]
        
        if tasks_to_remove:
            logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")
        
        return len(tasks_to_remove)
    
    def get_task_count(self) -> int:
        """Get the total number of tasks"""
        with self._lock:
            return len(self._tasks)
    
    def delete_task(self, task_id: str) -> bool:
        """Delete a task record by ID. Returns True if task was found and deleted, False otherwise."""
        with self._lock:
            if task_id in self._tasks:
                del self._tasks[task_id]
                logger.info(f"Deleted task {task_id}")
                return True
            else:
                logger.warning(f"Attempted to delete non-existent task {task_id}")
                return False
    
    def get_task_stats(self) -> Dict[str, Any]:
        """Get statistics about tasks"""
        with self._lock:
            stats = {
                'total_tasks': len(self._tasks),
                'by_status': {}
            }
            
            for status in TaskStatus:
                stats['by_status'][status.value] = sum(
                    1 for task in self._tasks.values() 
                    if task.status == status
                )
        
        return stats

# Global task manager instance
task_manager = TaskManager()
