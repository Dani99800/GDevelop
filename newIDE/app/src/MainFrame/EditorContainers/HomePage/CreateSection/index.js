// @flow
import * as React from 'react';
import { t, Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';
import { I18n as I18nType } from '@lingui/core';
import SectionContainer, { SectionRow } from '../SectionContainer';
import ErrorBoundary from '../../../../UI/ErrorBoundary';
import AuthenticatedUserContext from '../../../../Profile/AuthenticatedUserContext';
import GamesList from '../../../../GameDashboard/GamesList';
import { deleteGame, type Game } from '../../../../Utils/GDevelopServices/Game';
import { type QuickCustomizationRecommendation } from '../../../../Utils/GDevelopServices/User';
import PlaceholderError from '../../../../UI/PlaceholderError';
import PlaceholderLoader from '../../../../UI/PlaceholderLoader';
import { Column, Line } from '../../../../UI/Grid';
import { ColumnStackLayout } from '../../../../UI/Layout';
import { type GameDetailsTab } from '../../../../GameDashboard';
import GameDashboard from '../../../../GameDashboard';
import useAlertDialog from '../../../../UI/Alert/useAlertDialog';
import RouterContext from '../../../RouterContext';
import { extractGDevelopApiErrorStatusAndCode } from '../../../../Utils/GDevelopServices/Errors';
import UserEarningsWidget from '../../../../GameDashboard/Monetization/UserEarningsWidget';
import { showErrorBox } from '../../../../UI/Messages/MessageBox';
import {
  type FileMetadataAndStorageProviderName,
  type FileMetadata,
  type StorageProvider,
} from '../../../../ProjectsStorage';
import Text from '../../../../UI/Text';
import Grid from '@material-ui/core/Grid';
import WalletWidget from '../../../../GameDashboard/Wallet/WalletWidget';
import TotalPlaysWidget from '../../../../GameDashboard/Widgets/TotalPlaysWidget';
import { QuickCustomizationGameTiles } from '../../../../QuickCustomization/QuickCustomizationGameTiles';
import { type NewProjectSetup } from '../../../../ProjectCreation/NewProjectSetupDialog';
import { type ExampleShortHeader } from '../../../../Utils/GDevelopServices/Example';
import UrlStorageProvider from '../../../../ProjectsStorage/UrlStorageProvider';
import {
  type WindowSizeType,
  useResponsiveWindowSize,
} from '../../../../UI/Responsive/ResponsiveWindowMeasurer';
import { type PrivateGameTemplateListingData } from '../../../../Utils/GDevelopServices/Shop';
import FlatButton from '../../../../UI/FlatButton';
import ChevronArrowRight from '../../../../UI/CustomSvgIcons/ChevronArrowRight';
import ExampleStore from '../../../../AssetStore/ExampleStore';
import {
  checkIfHasTooManyCloudProjects,
  MaxProjectCountAlertMessage,
} from './MaxProjectCountAlertMessage';
import { SubscriptionSuggestionContext } from '../../../../Profile/Subscription/SubscriptionSuggestionContext';

const getExampleItemsColumns = (
  windowSize: WindowSizeType,
  isLandscape: boolean
) => {
  switch (windowSize) {
    case 'small':
      return isLandscape ? 4 : 2;
    case 'medium':
      return 3;
    case 'large':
      return 4;
    case 'xlarge':
      return 6;
    default:
      return 4;
  }
};

type Props = {|
  project: ?gdProject,
  currentFileMetadata: ?FileMetadata,
  onOpenProject: (file: FileMetadataAndStorageProviderName) => Promise<void>,
  storageProviders: Array<StorageProvider>,
  closeProject: () => Promise<void>,
  canOpen: boolean,
  onOpenProfile: () => void,
  askToCloseProject: () => Promise<boolean>,
  onCreateProjectFromExample: (
    exampleShortHeader: ExampleShortHeader,
    newProjectSetup: NewProjectSetup,
    i18n: I18nType
  ) => Promise<void>,
  onSelectPrivateGameTemplateListingData: (
    privateGameTemplateListingData: PrivateGameTemplateListingData
  ) => void,
  onSelectExampleShortHeader: (exampleShortHeader: ExampleShortHeader) => void,
  i18n: I18nType,
  games: ?Array<Game>,
  onRefreshGames: () => Promise<void>,
  onGameUpdated: (game: Game) => void,
  gamesFetchingError: ?Error,
  openedGame: ?Game,
  setOpenedGameId: (gameId: ?string) => void,
  currentTab: GameDetailsTab,
  setCurrentTab: GameDetailsTab => void,
  onOpenNewProjectSetupDialog: () => void,
  onChooseProject: () => void,
|};

const CreateSection = ({
  project,
  currentFileMetadata,
  onOpenProject,
  storageProviders,
  closeProject,
  canOpen,
  onOpenProfile,
  askToCloseProject,
  onCreateProjectFromExample,
  onSelectPrivateGameTemplateListingData,
  onSelectExampleShortHeader,
  i18n,
  games,
  onRefreshGames,
  onGameUpdated,
  gamesFetchingError,
  openedGame,
  setOpenedGameId,
  currentTab,
  setCurrentTab,
  onOpenNewProjectSetupDialog,
  onChooseProject,
}: Props) => {
  const authenticatedUser = React.useContext(AuthenticatedUserContext);
  const {
    profile,
    getAuthorizationHeader,
    loginState,
    recommendations,
    limits,
  } = authenticatedUser;
  const { showAlert, showConfirmation } = useAlertDialog();
  const [
    gameUnregisterErrorText,
    setGameUnregisterErrorText,
  ] = React.useState<?React.Node>(null);
  const [showAllGameTemplates, setShowAllGameTemplates] = React.useState(false);
  const { routeArguments, removeRouteArguments } = React.useContext(
    RouterContext
  );
  const { openSubscriptionDialog } = React.useContext(
    SubscriptionSuggestionContext
  );
  // $FlowIgnore
  const quickCustomizationRecommendation: ?QuickCustomizationRecommendation = React.useMemo(
    () => {
      return recommendations
        ? recommendations.find(
            recommendation => recommendation.type === 'quick-customization'
          )
        : null;
    },
    [recommendations]
  );
  const { windowSize, isMobile, isLandscape } = useResponsiveWindowSize();
  const hasTooManyCloudProjects = checkIfHasTooManyCloudProjects(
    authenticatedUser
  );

  React.useEffect(
    () => {
      onRefreshGames();
    },
    // Refresh the games when the callback changes (defined in useGamesList), that's
    // to say when the user profile changes.
    [onRefreshGames]
  );

  React.useEffect(
    () => {
      if (openedGame && !profile) {
        setOpenedGameId(null);
      }
    },
    // Close game view is user logs out.
    [profile, openedGame, setOpenedGameId]
  );

  const unregisterGame = React.useCallback(
    async (i18n: I18nType) => {
      if (!profile || !openedGame) return;

      const answer = await showConfirmation({
        title: t`Unregister game`,
        message: t`Are you sure you want to unregister this game?${'\n\n'}It will disappear from your games dashboard and you won't get access to player services, unless you register it again.`,
      });
      if (!answer) return;

      const { id } = profile;
      setGameUnregisterErrorText(null);
      try {
        await deleteGame(getAuthorizationHeader, id, openedGame.id);
        setOpenedGameId(null);
      } catch (error) {
        console.error('Unable to delete the game:', error);
        const extractedStatusAndCode = extractGDevelopApiErrorStatusAndCode(
          error
        );
        if (
          extractedStatusAndCode &&
          extractedStatusAndCode.code === 'game-deletion/leaderboards-exist'
        ) {
          setGameUnregisterErrorText(
            i18n._(
              t`You cannot unregister a game that has active leaderboards. To delete them, go in the Leaderboards tab, and delete them one by one.`
            )
          );
        } else {
          showErrorBox({
            message:
              i18n._(t`Unable to unregister the game.`) +
              ' ' +
              i18n._(t`Verify your internet connection or try again later.`),
            rawError: error,
            errorId: 'game-dashboard-unregister-game',
          });
        }
      }
      onRefreshGames();
    },
    [
      openedGame,
      profile,
      getAuthorizationHeader,
      onRefreshGames,
      setOpenedGameId,
      showConfirmation,
    ]
  );

  React.useEffect(
    () => {
      const loadInitialGame = async () => {
        // When games are loaded and we have an initial game id, try to open it.
        const initialGameId = routeArguments['game-id'];
        if (games && initialGameId) {
          const game = games.find(game => game.id === initialGameId);
          removeRouteArguments(['game-id']);
          if (game) {
            setOpenedGameId(game.id);
          } else {
            await showAlert({
              title: t`Game not found`,
              message: t`The game you're trying to open is not registered online. Open the project
              file, then register it before continuing.`,
            });
          }
        }
      };
      loadInitialGame();
    },
    [
      games,
      routeArguments,
      removeRouteArguments,
      showConfirmation,
      showAlert,
      project,
      setOpenedGameId,
    ]
  );

  const onBack = React.useCallback(
    () => {
      setCurrentTab('details');
      setOpenedGameId(null);
    },
    [setCurrentTab, setOpenedGameId]
  );

  if (openedGame) {
    return (
      <SectionContainer flexBody>
        <GameDashboard
          project={project}
          currentFileMetadata={currentFileMetadata}
          onOpenProject={onOpenProject}
          storageProviders={storageProviders}
          closeProject={closeProject}
          currentView={currentTab}
          setCurrentView={setCurrentTab}
          game={openedGame}
          onBack={onBack}
          onGameUpdated={onGameUpdated}
          onUnregisterGame={unregisterGame}
          gameUnregisterErrorText={gameUnregisterErrorText}
        />
      </SectionContainer>
    );
  }

  if (showAllGameTemplates) {
    return (
      <SectionContainer
        backAction={() => setShowAllGameTemplates(false)}
        flexBody
      >
        <SectionRow expand>
          <ExampleStore
            onSelectExampleShortHeader={onSelectExampleShortHeader}
            onSelectPrivateGameTemplateListingData={
              onSelectPrivateGameTemplateListingData
            }
            i18n={i18n}
            columnsCount={getExampleItemsColumns(windowSize, isLandscape)}
          />
        </SectionRow>
      </SectionContainer>
    );
  }

  return (
    <I18n>
      {({ i18n }) => (
        <SectionContainer
          flexBody
          renderFooter={
            !isMobile && limits && hasTooManyCloudProjects
              ? () => (
                  <Line>
                    <Column expand>
                      <MaxProjectCountAlertMessage
                        limits={limits}
                        onUpgrade={() =>
                          openSubscriptionDialog({
                            analyticsMetadata: {
                              reason: 'Cloud Project limit reached',
                            },
                          })
                        }
                      />
                    </Column>
                  </Line>
                )
              : undefined
          }
        >
          <SectionRow expand>
            {!!profile || loginState === 'done' ? (
              <ColumnStackLayout noMargin>
                {games && games.length !== 0 ? (
                  <ColumnStackLayout noMargin>
                    <Line noMargin>
                      <Text size="section-title" noMargin>
                        <Trans>Performance Dashboard</Trans>
                      </Text>
                    </Line>
                    <Grid container spacing={2}>
                      <UserEarningsWidget />
                      <TotalPlaysWidget games={games} />
                      <WalletWidget
                        onOpenProfile={onOpenProfile}
                        showRandomBadge
                      />
                    </Grid>
                  </ColumnStackLayout>
                ) : (
                  <Grid container spacing={2}>
                    <WalletWidget onOpenProfile={onOpenProfile} fullWidth />
                  </Grid>
                )}
                <GamesList
                  storageProviders={storageProviders}
                  project={project}
                  games={games || []}
                  onRefreshGames={onRefreshGames}
                  onOpenGameId={setOpenedGameId}
                  onOpenProject={onOpenProject}
                  canOpen={canOpen}
                  onOpenNewProjectSetupDialog={onOpenNewProjectSetupDialog}
                  onChooseProject={onChooseProject}
                  currentFileMetadata={currentFileMetadata}
                  closeProject={closeProject}
                  askToCloseProject={askToCloseProject}
                />
                {/* Check if looks ok */}
                {isMobile && limits && hasTooManyCloudProjects && (
                  <MaxProjectCountAlertMessage
                    margin="dense"
                    limits={limits}
                    onUpgrade={() =>
                      openSubscriptionDialog({
                        analyticsMetadata: {
                          reason: 'Cloud Project limit reached',
                        },
                      })
                    }
                  />
                )}
                {(!games || games.length === 0) &&
                  !project &&
                  quickCustomizationRecommendation && (
                    <ColumnStackLayout noMargin>
                      <Line noMargin>
                        <Text size="block-title" noMargin>
                          <Trans>Publish your first game</Trans>
                        </Text>
                      </Line>
                      <QuickCustomizationGameTiles
                        onSelectExampleShortHeader={async exampleShortHeader => {
                          const projectIsClosed = await askToCloseProject();
                          if (!projectIsClosed) {
                            return;
                          }

                          const newProjectSetup: NewProjectSetup = {
                            storageProvider: UrlStorageProvider,
                            saveAsLocation: null,
                            openQuickCustomizationDialog: true,
                          };
                          onCreateProjectFromExample(
                            exampleShortHeader,
                            newProjectSetup,
                            i18n
                          );
                        }}
                        quickCustomizationRecommendation={
                          quickCustomizationRecommendation
                        }
                      />
                      <Line noMargin justifyContent="space-between">
                        <Text size="block-title" noMargin>
                          <Trans>Remix an existing game</Trans>
                        </Text>
                        <FlatButton
                          onClick={() => setShowAllGameTemplates(true)}
                          label={
                            isMobile ? (
                              <Trans>Browse</Trans>
                            ) : (
                              <Trans>Browse all templates</Trans>
                            )
                          }
                          leftIcon={<ChevronArrowRight fontSize="small" />}
                        />
                      </Line>
                      <ExampleStore
                        onSelectExampleShortHeader={onSelectExampleShortHeader}
                        onSelectPrivateGameTemplateListingData={
                          onSelectPrivateGameTemplateListingData
                        }
                        i18n={i18n}
                        columnsCount={getExampleItemsColumns(
                          windowSize,
                          isLandscape
                        )}
                        hideSearch
                        onlyShowGames
                      />
                    </ColumnStackLayout>
                  )}
              </ColumnStackLayout>
            ) : gamesFetchingError ? (
              <PlaceholderError onRetry={onRefreshGames}>
                <Trans>
                  Can't load the games. Verify your internet connection or retry
                  later.
                </Trans>
              </PlaceholderError>
            ) : (
              <Column expand justifyContent="center">
                <PlaceholderLoader />
              </Column>
            )}
          </SectionRow>
        </SectionContainer>
      )}
    </I18n>
  );
};

const CreateSectionWithErrorBoundary = (props: Props) => (
  <ErrorBoundary
    componentTitle={<Trans>Create section</Trans>}
    scope="start-page-create"
  >
    <CreateSection {...props} />
  </ErrorBoundary>
);

export default CreateSectionWithErrorBoundary;
