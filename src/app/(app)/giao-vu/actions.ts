"use server";
import { peopleActions } from "@/server/people-actions";

const A = peopleActions("coordinator");
export const createCoordinator = A.create;
export const updateCoordinator = A.update;
export const deleteCoordinator = A.remove;
export const resetCoordinatorPassword = A.reset;
