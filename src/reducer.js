/* @flow */

import { get, isEqual, find, without } from "lodash";
import actionTypes from "./actionTypes";
import type {
  FluxAction,
  FluxActionWithPreviousIntent,
  FluxActionForRemoval,
  NetworkState
} from "./types";

export const initialState = {
  isConnected: true,
  actionQueue: []
};

function handleOfflineAction(
  state: NetworkState,
  {
    payload: { prevAction, prevThunk } = {},
    meta
  }: FluxActionWithPreviousIntent
): NetworkState {
  const isActionToRetry =
    typeof prevAction === "object" && get(meta, "retry") === true;

  const isThunkToRetry =
    typeof prevThunk === "function" && get(prevThunk, "meta.retry") === true;

  if (isActionToRetry || isThunkToRetry) {
    // If a similar action already existed on the queue, we remove it and push it again to the end of the queue
    const actionToLookUp = prevAction || prevThunk;
    const actionWithMetaData =
      typeof actionToLookUp === "object"
        ? { ...actionToLookUp, meta }
        : actionToLookUp;
    const similarActionQueued = find(state.actionQueue, (action: *) =>
      isEqual(action, actionWithMetaData)
    );

    let actionQueue = similarActionQueued
      ? [...without(state.actionQueue, similarActionQueued)]
      : [...state.actionQueue];
    // this should filter out any duplicate actions, as well as any of type SAGA_SYNC_APPOINTMENT that are for the same appointment.
    // Multiple SAGA_SYNC_APPOINTMENT actions should be allowed as long as they are all for different appointments

    let filterOutSyncs =
      actionWithMetaData.type === "SAGA_SYNC_APPOINTMENT"
        ? actionQueue.filter(a => {
            if (a.type !== "SAGA_SYNC_APPOINTMENT") {
              return true;
            } else if (
              a.type === "SAGA_SYNC_APPOINTMENT" &&
              a.meta.appointment_id !== actionWithMetaData.meta.appointment_id
            ) {
              return true;
            } else {
              return false;
            }
          })
        : actionQueue;

    let newActionQueue = [...filterOutSyncs, actionWithMetaData];

    return {
      ...state,
      actionQueue: newActionQueue
    };
  }
  return state;
}

function handleRemoveActionFromQueue(
  state: NetworkState,
  action: FluxActionForRemoval
): NetworkState {
  const similarActionQueued = find(state.actionQueue, (a: *) =>
    isEqual(action, a)
  );

  return {
    ...state,
    actionQueue: without(state.actionQueue, similarActionQueued)
  };
}

function handleDismissActionsFromQueue(
  state: NetworkState,
  triggerActionToDismiss: string
): NetworkState {
  const newActionQueue = state.actionQueue.filter((action: FluxAction) => {
    const dismissArray = get(action, "meta.dismiss", []);
    return !dismissArray.includes(triggerActionToDismiss);
  });

  return {
    ...state,
    actionQueue: newActionQueue
  };
}

// removes actions from the queue that no longer correspond to any appointments in the list
function filterOldActions(state, action) {
  let actionsToKeep = state.actionQueue.filter(a => {
    let find = action.payload.find(appt => appt.id === a.meta.appointment_id);
    return find;
  });

  return {
    ...state,
    // actionQueue: []
    actionQueue: actionsToKeep
  };
}

export default function(
  state: NetworkState = initialState,
  action: *
): NetworkState {
  switch (action.type) {
    case actionTypes.CONNECTION_CHANGE:
      return {
        ...state,
        isConnected: action.payload
      };
    case "FILTER_OLD_ACTIONS":
      return filterOldActions(state, action);
    case actionTypes.FETCH_OFFLINE_MODE:
      return handleOfflineAction(state, action);
    case actionTypes.REMOVE_FROM_ACTION_QUEUE:
      return handleRemoveActionFromQueue(state, action.payload);
    case actionTypes.DISMISS_ACTIONS_FROM_QUEUE:
      return handleDismissActionsFromQueue(state, action.payload);
    default:
      return state;
  }
}
