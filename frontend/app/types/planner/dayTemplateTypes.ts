import { nanoid } from 'nanoid';

export interface DayTemplate {
    id: string;                 // Unique identifier for the day template with nano ID
    name: string;
    createdAt: string;          // Date when the day template was created
    updatedAt: string;          // Date when the day template was last updated
    description?: string;
    timeBlocks?: TimeBlock[];    // Array of time blocks associated with the day template
}

export interface TimeBlock {
    id: string;             // Unique identifier for the time block with nano ID
    startTime: number;      // Float from 0 to 24 representing the start time in hours
    endTime: number;        // Float from 0 to 24 representing the end time in hours
    title: string;          // Title of the time block
    group?: string;         // Group to which the time block belongs
    description?: string;   // Optional description of the time block
}

export function createTimeBlock(
    startTime: number,
    endTime: number,
    title: string,
    group?: string,
    description?: string
): TimeBlock {
    // Sanity checks and validation
    if (startTime < 0 || startTime > 24 || endTime < 0 || endTime > 24) {
        throw new Error('Start and end times must be between 0 and 24.');
    }
    if (startTime >= endTime) {
        throw new Error('Start time must be less than end time.');
    }
    // Enforce 5-minute intervals
    if ((startTime * 60) % 5 !== 0 || (endTime * 60) % 5 !== 0) {
        throw new Error('Start and end times must be in 5-minute intervals.');
    }
    return {
        id: nanoid(),
        startTime,
        endTime,
        title,
        group,
        description
    };
}

export function modifyTimeBlockTimes(
    timeBlock: TimeBlock,
    newStartTime: number,
    newEndTime: number
): TimeBlock {
    // Sanity checks and validation
    if (newStartTime < 0 || newStartTime > 24 || newEndTime < 0 || newEndTime > 24) {
        throw new Error('Start and end times must be between 0 and 24.');
    }
    if (newStartTime >= newEndTime) {
        throw new Error('Start time must be less than end time.');
    }
    // Enforce 5-minute intervals
    if ((newStartTime * 60) % 5 !== 0 || (newEndTime * 60) % 5 !== 0) {
        throw new Error('Start and end times must be in 5-minute intervals.');
    }
    return {
        ...timeBlock,
        startTime: newStartTime,
        endTime: newEndTime
    };
}

export function createDayTemplate(
    name: string,
    description?: string
): DayTemplate {
    return {
        id: nanoid(),
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        description
    };
}

export function addTimeBlockToDayTemplate(
    dayTemplate: DayTemplate,
    timeBlock: TimeBlock
): DayTemplate {
    // Ensure that no time blocks overlap
    if (dayTemplate.timeBlocks) {
        for (const block of dayTemplate.timeBlocks) {
            if (
                (timeBlock.startTime < block.endTime && timeBlock.endTime > block.startTime) ||
                (block.startTime < timeBlock.endTime && block.endTime > timeBlock.startTime)
            ) {
                throw new Error('Time blocks cannot overlap.');
            }
        }
    }
    return {
        ...dayTemplate,
        timeBlocks: [...(dayTemplate.timeBlocks || []), timeBlock],
        updatedAt: new Date().toISOString()
    };
}