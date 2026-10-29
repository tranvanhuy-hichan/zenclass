"use server";
import { peopleActions } from "@/server/people-actions";

const A = peopleActions("assistant");
export const createAssistant = A.create;
export const updateAssistant = A.update;
export const deleteAssistant = A.remove;
export const resetAssistantPassword = A.reset;
